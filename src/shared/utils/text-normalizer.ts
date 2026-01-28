/**
 * Text normalization utilities for matching and comparison.
 */

/**
 * Normalizes text for matching purposes.
 * - Converts to lowercase
 * - Trims whitespace
 * - Normalizes various dash characters to hyphen
 * - Replaces dashes and colons with spaces
 * - Collapses multiple spaces
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[–—‐‑−]/g, '-') // Normalize various dashes to hyphen
    .replace(/[-:]+/g, ' ') // Replace dashes and colons with space
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Checks if normalized text contains normalized search term.
 */
export function normalizedIncludes(text: string, searchTerm: string): boolean {
  return normalizeForMatching(text).includes(normalizeForMatching(searchTerm));
}
