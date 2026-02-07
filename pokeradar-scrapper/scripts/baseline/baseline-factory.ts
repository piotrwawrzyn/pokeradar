/**
 * BaselineScraperFactory - IScraperFactory implementation for baseline testing.
 *
 * Purpose:
 * - Creates scrapers with recording or replay engines based on mode
 * - Integrates with ScanCycleRunner for production-like scanning
 * - Groups shops appropriately for each mode (replay = all cheerio)
 *
 * Recording mode:
 * - Uses RecordingCheerioEngine or RecordingPlaywrightEngine
 * - Preserves original engine grouping (Playwright shops need real browser)
 * - Makes real HTTP requests and saves HTML
 *
 * Replay mode:
 * - Uses ReplayEngine for ALL shops (Cheerio-based, works on saved HTML)
 * - Groups all shops as 'cheerio' to avoid launching Playwright browser
 * - Fast, deterministic, offline
 */

import { Browser } from 'playwright';
import { ShopConfig } from '../../src/shared/types';
import { DefaultScraper } from '../../src/scraper/scrapers/default-scraper';
import { IScraper, IScraperLogger } from '../../src/scraper/scrapers/base/base-scraper';
import { IScraperFactory, IMultiUserDispatcher } from '../../src/scraper/monitoring/scan-cycle-runner';
import { ScraperFactory } from '../../src/scraper/scrapers/scraper-factory';
import { FixtureStore } from './engines/fixture-store';
import { RecordingCheerioEngine } from './engines/recording-cheerio-engine';
import { RecordingPlaywrightEngine } from './engines/recording-playwright-engine';
import { ReplayEngine } from './engines/replay-engine';

/**
 * Tracks timing and request counts per shop for performance regression detection.
 */
export class TimingTracker {
  private startTimes = new Map<string, number>();
  private durations = new Map<string, number>();
  private requestCounts = new Map<string, number>();

  /**
   * Marks the start of scraping for a shop.
   */
  startShop(shopId: string): void {
    this.startTimes.set(shopId, Date.now());
    if (!this.requestCounts.has(shopId)) {
      this.requestCounts.set(shopId, 0);
    }
  }

  /**
   * Marks the end of scraping for a shop and records duration.
   */
  endShop(shopId: string): void {
    const start = this.startTimes.get(shopId);
    if (start) {
      const duration = Date.now() - start;
      this.durations.set(shopId, duration);
      this.startTimes.delete(shopId);
    }
  }

  /**
   * Increments the request count for a shop (called on each goto()).
   */
  incrementRequests(shopId: string): void {
    const current = this.requestCounts.get(shopId) || 0;
    this.requestCounts.set(shopId, current + 1);
  }

  /**
   * Gets all recorded durations.
   */
  getAll(): Record<string, number> {
    return Object.fromEntries(this.durations);
  }

  /**
   * Gets all recorded request counts.
   */
  getAllRequestCounts(): Record<string, number> {
    return Object.fromEntries(this.requestCounts);
  }

  /**
   * Clears all timing data.
   */
  clear(): void {
    this.startTimes.clear();
    this.durations.clear();
    this.requestCounts.clear();
  }
}

/**
 * Scraper factory for baseline recording and replay.
 */
export class BaselineScraperFactory implements IScraperFactory {
  constructor(
    private mode: 'record' | 'replay',
    private fixtureStore: FixtureStore,
    private timingTracker: TimingTracker
  ) {}

  /**
   * Creates a scraper with appropriate engine for the current mode.
   *
   * Recording mode: Uses recording engines (live HTTP/browser)
   * Replay mode: Uses replay engine (saved HTML)
   */
  create(shop: ShopConfig, logger?: IScraperLogger, browser?: Browser): IScraper {
    let engine;

    if (this.mode === 'record') {
      // Recording: use real engines that save HTML
      if (shop.engine === 'playwright') {
        engine = new RecordingPlaywrightEngine(browser, this.fixtureStore, shop.id, logger);
      } else {
        engine = new RecordingCheerioEngine(this.fixtureStore, shop.id, logger);
      }
    } else {
      // Replay: use replay engine for all shops (cheerio-based)
      engine = new ReplayEngine(this.fixtureStore, shop.id, logger);
    }

    // Wrap the engine with timing tracking
    const timedEngine = this.wrapWithTiming(engine, shop.id);

    return new DefaultScraper(shop, timedEngine, logger);
  }

  /**
   * Groups shops by engine type.
   *
   * In replay mode, returns all shops as 'cheerio' to avoid launching browser.
   * In record mode, preserves production grouping.
   */
  groupByEngine(shops: ShopConfig[]): { cheerio: ShopConfig[]; playwright: ShopConfig[] } {
    if (this.mode === 'replay') {
      // All shops use ReplayEngine (cheerio-based) - no browser needed
      return { cheerio: shops, playwright: [] };
    }

    // Recording mode: preserve original grouping
    return ScraperFactory.groupByEngine(shops);
  }

  /**
   * Wraps an engine to track timing and request counts without modifying the engine itself.
   * Times from first goto() to close().
   * Counts each goto() call as a network request.
   */
  private wrapWithTiming(engine: any, shopId: string): any {
    const tracker = this.timingTracker;
    let hasStarted = false;

    const originalGoto = engine.goto.bind(engine);
    const originalClose = engine.close.bind(engine);

    engine.goto = async function (...args: any[]) {
      if (!hasStarted) {
        tracker.startShop(shopId);
        hasStarted = true;
      }
      tracker.incrementRequests(shopId);
      return originalGoto(...args);
    };

    engine.close = async function (...args: any[]) {
      if (hasStarted) {
        tracker.endShop(shopId);
      }
      return originalClose(...args);
    };

    return engine;
  }
}
