/**
 * FixtureStore manages HTML fixture files for baseline testing.
 *
 * Purpose:
 * - During recording: saves fetched HTML to disk for later replay
 * - During replay: loads saved HTML to simulate HTTP responses
 *
 * Storage structure:
 *   scripts/baseline/fixtures/
 *     {shopId}/
 *       {url-hash}.html
 *     _baseline.json
 *
 * URL-to-filename mapping:
 * - Strips protocol and converts URL to safe filename
 * - Truncates long URLs to prevent filesystem issues
 * - Ensures deterministic mapping (same URL = same filename)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Manages reading and writing HTML fixture files.
 */
export class FixtureStore {
  private fixturesDir: string;

  /**
   * @param baseDir - Base directory for fixtures (default: scripts/baseline/fixtures)
   */
  constructor(baseDir?: string) {
    this.fixturesDir = baseDir || path.join(__dirname, '..', 'fixtures');
    this.ensureDir(this.fixturesDir);
  }

  /**
   * Saves HTML content for a specific shop and URL.
   * Creates shop directory if it doesn't exist.
   *
   * @param shopId - Shop identifier (e.g., "letsgotry")
   * @param url - Full URL that was fetched
   * @param html - HTML content to save
   */
  saveHtml(shopId: string, url: string, html: string): void {
    const shopDir = path.join(this.fixturesDir, shopId);
    this.ensureDir(shopDir);

    const filename = this.urlToFilename(url);
    const filepath = path.join(shopDir, filename);

    fs.writeFileSync(filepath, html, 'utf-8');
  }

  /**
   * Loads HTML content for a specific shop and URL.
   *
   * @param shopId - Shop identifier
   * @param url - Full URL to load fixture for
   * @returns HTML content
   * @throws Error if fixture doesn't exist
   */
  loadHtml(shopId: string, url: string): string {
    const shopDir = path.join(this.fixturesDir, shopId);
    const filename = this.urlToFilename(url);
    const filepath = path.join(shopDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(
        `Fixture not found for ${shopId}: ${url}\n` +
        `Expected file: ${filepath}\n` +
        `Run 'npm run baseline:record' to create fixtures.`
      );
    }

    return fs.readFileSync(filepath, 'utf-8');
  }

  /**
   * Checks if a fixture exists for the given shop and URL.
   *
   * @param shopId - Shop identifier
   * @param url - Full URL to check
   * @returns true if fixture exists
   */
  hasFixture(shopId: string, url: string): boolean {
    const shopDir = path.join(this.fixturesDir, shopId);
    const filename = this.urlToFilename(url);
    const filepath = path.join(shopDir, filename);
    return fs.existsSync(filepath);
  }

  /**
   * Gets the base fixtures directory path.
   */
  getFixturesDir(): string {
    return this.fixturesDir;
  }

  /**
   * Converts a URL to a safe, deterministic filename.
   *
   * Strategy:
   * 1. Create a hash of the full URL for uniqueness
   * 2. Extract meaningful parts (domain, path prefix) for readability
   * 3. Combine into: {readable-prefix}--{hash}.html
   *
   * Examples:
   *   https://letsgotry.pl/search?q=Surging+Sparks
   *     -> letsgotry-search--a1b2c3d4.html
   *
   *   https://letsgotry.pl/produkt/etb-surging-sparks-123
   *     -> letsgotry-produkt-etb--e5f6g7h8.html
   *
   * @param url - Full URL
   * @returns Safe filename with .html extension
   */
  private urlToFilename(url: string): string {
    // Create hash for uniqueness
    const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8);

    // Extract readable parts
    let readable = url
      .replace(/^https?:\/\//, '')  // Remove protocol
      .replace(/[^a-z0-9]+/gi, '-') // Replace non-alphanumeric with dash
      .toLowerCase()
      .slice(0, 60);                // Truncate to reasonable length

    // Remove leading/trailing dashes
    readable = readable.replace(/^-+|-+$/g, '');

    return `${readable}--${hash}.html`;
  }

  /**
   * Ensures a directory exists, creating it if necessary.
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
