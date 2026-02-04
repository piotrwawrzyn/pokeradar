/**
 * Shared selector processing utilities for engines.
 */

import { Selector, SelectorType } from '../../shared/types';

/**
 * Normalizes selector value to an array for iteration.
 * Handles both single string and array of fallback selectors.
 */
export function normalizeSelectors(selector: Selector): string[] {
  return Array.isArray(selector.value) ? selector.value : [selector.value];
}

/**
 * Gets the first selector value from a selector.
 */
export function getFirstSelector(selector: Selector): string {
  return Array.isArray(selector.value) ? selector.value[0] : selector.value;
}

/**
 * Tries multiple selectors in sequence until one succeeds.
 * Returns the result of the first successful selector, or null if all fail.
 *
 * @param selectors - Array of selector values to try
 * @param tryFn - Function that attempts to extract using a selector
 * @param onError - Optional callback for handling errors
 * @returns Result of first successful extraction, or null
 */
export async function trySelectors<T>(
  selectors: string[],
  tryFn: (selector: string) => Promise<T | null>,
  onError?: (selector: string, error: unknown) => void
): Promise<T | null> {
  for (const selector of selectors) {
    try {
      const result = await tryFn(selector);
      if (result !== null) {
        return result;
      }
    } catch (error) {
      onError?.(selector, error);
    }
  }
  return null;
}

/**
 * Converts selector type and value to CSS-compatible selector for Cheerio.
 * Cheerio has limited support for non-CSS selectors.
 */
export function toCssSelector(type: SelectorType, value: string): string {
  switch (type) {
    case 'css':
      return value;
    case 'text':
      return `:contains("${value}")`;
    case 'xpath':
      // XPath not fully supported in Cheerio
      console.warn(`XPath selector "${value}" not fully supported in Cheerio, attempting as CSS`);
      return value;
    default:
      throw new Error(`Unknown selector type: ${type}`);
  }
}

/**
 * Converts selector type and value to Playwright locator string.
 */
export function toPlaywrightLocator(type: SelectorType, value: string): string {
  switch (type) {
    case 'css':
      return value;
    case 'xpath':
      return `xpath=${value}`;
    case 'text':
      return `text=${value}`;
    default:
      throw new Error(`Unknown selector type: ${type}`);
  }
}
