import { PriceFormat } from '../types';

export class PriceParser {
  /**
   * Parses a price string based on the specified format.
   */
  parse(priceText: string, format: PriceFormat = 'european'): number | null {
    if (!priceText) {
      return null;
    }

    switch (format) {
      case 'european':
        return this.parseEuropean(priceText);
      case 'us':
        return this.parseUS(priceText);
      default:
        throw new Error(`Unsupported price format: ${format}`);
    }
  }

  /**
   * Parses European price format (Polish złoty).
   * Handles:
   * - 79,95 zł
   * - zł 79,95
   * - 79 zł (no decimals)
   * - 1.299,95 zł (thousands separator)
   * - 79,95zł (no space)
   */
  private parseEuropean(priceText: string): number | null {
    // Remove currency symbols and extra whitespace
    const cleaned = priceText.trim();

    // Match number patterns:
    // - Optional thousands separator (dot): 1.299
    // - Main number: 123
    // - Optional decimal part (comma): ,95
    const regex = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/;
    const match = cleaned.match(regex);

    if (!match) {
      return null;
    }

    // Convert European format to standard decimal:
    // 1.299,95 → 1299.95
    const numberStr = match[1]
      .replace(/\./g, '')     // Remove thousands separator
      .replace(',', '.');     // Replace decimal comma with dot

    const parsed = parseFloat(numberStr);

    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parses US price format.
   * Handles:
   * - $79.95
   * - 79.95 USD
   * - 1,299.95 (thousands separator)
   */
  private parseUS(priceText: string): number | null {
    const cleaned = priceText.trim();

    // Match number patterns with comma as thousands separator and dot as decimal
    const regex = /(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/;
    const match = cleaned.match(regex);

    if (!match) {
      return null;
    }

    // Remove thousands separator
    const numberStr = match[1].replace(/,/g, '');
    const parsed = parseFloat(numberStr);

    return isNaN(parsed) ? null : parsed;
  }
}
