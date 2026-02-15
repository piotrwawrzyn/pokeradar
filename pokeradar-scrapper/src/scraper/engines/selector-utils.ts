/**
 * Shared selector processing utilities for engines.
 */

import type * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { Selector } from '../../shared/types';

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
 * Finds elements by text content with case-insensitive matching within a Cheerio root.
 */
export function findByTextInsensitive(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
  value: string
): cheerio.Cheerio<AnyNode> {
  const valueLower = value.toLowerCase();
  return root.find('*').filter((_, el) =>
    $(el).text().toLowerCase().includes(valueLower)
  );
}

