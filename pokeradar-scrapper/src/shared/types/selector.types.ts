/**
 * Selector type definitions for DOM element extraction.
 */

export type SelectorType = 'css' | 'xpath' | 'text' | 'json-attribute';
export type PriceFormat = 'european' | 'us';
export type ExtractType = 'href' | 'text' | 'innerHTML' | 'ownText';
/** How to aggregate results across JSON array items. */
export type JsonCondition = 'some' | 'every' | 'none';

export interface Selector {
  type: SelectorType;
  value: string | string[]; // Array for fallback selectors
  extract?: ExtractType;
  format?: PriceFormat;
  matchSelf?: boolean; // If true, checks if the element itself matches instead of searching descendants

  /**
   * `json-attribute` fields — used when type is 'json-attribute'.
   *
   * Finds an element via `value` (CSS), reads `attribute`, parses it as JSON,
   * then evaluates `jsonFilter` (dot-notation path) on each item in the array.
   *
   * Match logic per item:
   *   - If `jsonExpect` is set  → strict equality (`=== jsonExpect`)
   *   - Otherwise               → JS truthiness (`Boolean(value)`)
   *
   * `condition` controls how item results are aggregated (default: 'some').
   *
   * Example — any variant in stock:
   *   { attribute: "data-product_variations", jsonFilter: "is_in_stock", condition: "some" }
   *
   * Example — any variant with a specific string status:
   *   { attribute: "data-variations", jsonFilter: "stock_status", jsonExpect: "instock", condition: "some" }
   */
  attribute?: string;
  jsonFilter?: string;
  jsonExpect?: unknown;
  condition?: JsonCondition;
}
