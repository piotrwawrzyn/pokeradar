/**
 * Engine interface for DOM extraction.
 * Both CheerioEngine and PlaywrightEngine implement this interface.
 */

import { Selector } from '../../shared/types';

/**
 * Abstraction over a DOM element, supporting both Cheerio and Playwright.
 */
export interface IElement {
  /**
   * Get the text content of this element.
   */
  getText(): Promise<string | null>;

  /**
   * Get an attribute value from this element.
   */
  getAttribute(name: string): Promise<string | null>;

  /**
   * Find a single child element matching the selector.
   */
  find(selector: Selector): Promise<IElement | null>;

  /**
   * Find all child elements matching the selector.
   */
  findAll(selector: Selector): Promise<IElement[]>;

  /**
   * Check if this element itself matches the selector (not its descendants).
   */
  matches(selector: Selector): Promise<boolean>;
}

/**
 * Engine interface for DOM extraction.
 */
export interface IEngine {
  /**
   * Navigate to a URL and load its content.
   */
  goto(url: string): Promise<void>;

  /**
   * Get the current page URL (after any redirects).
   */
  getCurrentUrl(): string | null;

  /**
   * Extract a single value using the selector.
   */
  extract(selector: Selector): Promise<string | null>;

  /**
   * Extract all elements matching the selector.
   */
  extractAll(selector: Selector): Promise<IElement[]>;

  /**
   * Check if an element matching the selector exists.
   */
  exists(selector: Selector): Promise<boolean>;

  /**
   * Release any resources held by the engine.
   */
  close(): Promise<void>;
}
