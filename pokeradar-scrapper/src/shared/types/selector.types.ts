/**
 * Selector type definitions for DOM element extraction.
 */

export type SelectorType = 'css' | 'xpath' | 'text';
export type PriceFormat = 'european' | 'us';
export type ExtractType = 'href' | 'text' | 'innerHTML';

export interface Selector {
  type: SelectorType;
  value: string | string[]; // Array for fallback selectors
  extract?: ExtractType;
  format?: PriceFormat;
  matchSelf?: boolean; // If true, checks if the element itself matches instead of searching descendants
}
