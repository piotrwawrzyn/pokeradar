/**
 * Message formatter for Telegram summary messages.
 * Consolidates formatting logic used by both SummaryService and summary entry point.
 */

import { WatchlistProductInternal } from '../shared/types';
import { BestPriceOffer, ProductSummary } from '../shared/types/summary.types';

/**
 * Formats date and time for display.
 */
export function formatDateTime(date: Date): { dateStr: string; timeStr: string } {
  const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('pl-PL');
  return { dateStr, timeStr };
}

/**
 * Formats a price with currency.
 */
export function formatPrice(price: number | null, currency: string = 'zl'): string {
  if (price === null) {
    return 'N/A';
  }
  return `${price.toFixed(2)} ${currency}`;
}

/**
 * Gets price indicator emoji based on whether price meets max threshold.
 */
export function getPriceIndicator(price: number, maxPrice: number): string {
  return price <= maxPrice ? '💚' : '🔴';
}

/**
 * Formats a summary message from BestPriceOffer array.
 * Used by SummaryService which collects data in memory.
 */
export function formatSummaryFromOffers(offers: BestPriceOffer[]): string {
  const { dateStr, timeStr } = formatDateTime(new Date());

  let message = `📊 *Price Summary*\n`;
  message += `📅 ${dateStr} ${timeStr}\n`;
  message += `─────────────────────\n\n`;

  const available = offers.filter(bp => bp.isAvailable && bp.price !== null);
  const notFound = offers.filter(bp => !bp.isAvailable || bp.price === null);

  // Available items section
  if (available.length > 0) {
    message += `✅ *Available Items (${available.length})*\n\n`;

    for (const bp of available) {
      const priceStr = bp.price!.toFixed(2);
      const maxPriceStr = bp.product.price.max.toFixed(2);
      const priceIndicator = getPriceIndicator(bp.price!, bp.product.price.max);

      message += `📦 *${bp.product.name}*\n`;
      message += `${priceIndicator} ${priceStr} zł (max: ${maxPriceStr} zł)\n`;
      message += `🏪 ${bp.shopName}\n`;
      message += `🔗 [View Product](${bp.productUrl})\n\n`;
    }
  }

  // Not found items section
  if (notFound.length > 0) {
    message += `❌ *Not Found (${notFound.length})*\n\n`;

    for (const bp of notFound) {
      message += `• ${bp.product.name}\n`;
    }
  }

  if (offers.length === 0) {
    message += `_No data collected yet_\n`;
  }

  message += `\n─────────────────────`;

  return message;
}

/**
 * Formats a summary message from ProductSummary array.
 * Used by summary entry point which queries from database.
 */
export function formatSummaryFromResults(summaries: ProductSummary[]): string {
  const { dateStr, timeStr } = formatDateTime(new Date());

  let message = `📊 *Price Summary*\n`;
  message += `📅 ${dateStr} ${timeStr}\n`;
  message += `─────────────────────\n\n`;

  const available = summaries.filter(
    s => s.result?.isAvailable && s.result?.price !== null
  );
  const notFound = summaries.filter(
    s => s.result && (!s.result.isAvailable || s.result.price === null)
  );
  const noData = summaries.filter(s => !s.result);

  // Available items section
  if (available.length > 0) {
    message += `✅ *Available Items (${available.length})*\n\n`;

    for (const s of available) {
      const priceStr = s.result!.price!.toFixed(2);
      const maxPriceStr = s.product.price.max.toFixed(2);
      const priceIndicator = getPriceIndicator(s.result!.price!, s.product.price.max);

      message += `📦 *${s.product.name}*\n`;
      message += `${priceIndicator} ${priceStr} zł (max: ${maxPriceStr} zł)\n`;
      message += `🏪 ${s.result!.shopId}\n`;
      message += `🔗 [View Product](${s.result!.productUrl})\n\n`;
    }
  }

  // Not found items section
  if (notFound.length > 0) {
    message += `❌ *Not Found (${notFound.length})*\n\n`;

    for (const s of notFound) {
      message += `• ${s.product.name}\n`;
    }
    message += `\n`;
  }

  // No data section - stale or missing results
  if (noData.length > 0) {
    message += `⚠️ *No Data (${noData.length})*\n\n`;

    for (const s of noData) {
      message += `• ${s.product.name}\n`;
    }
  }

  if (summaries.length === 0) {
    message += `_No products in watchlist_\n`;
  }

  message += `\n─────────────────────`;

  return message;
}

/**
 * Formats an individual product notification message.
 */
export function formatProductNotification(
  product: WatchlistProductInternal,
  price: number,
  shopName: string,
  productUrl: string
): string {
  const priceIndicator = getPriceIndicator(price, product.price.max);

  let message = `🔔 *Product Available!*\n\n`;
  message += `📦 *${product.name}*\n`;
  message += `${priceIndicator} ${price.toFixed(2)} zł (max: ${product.price.max.toFixed(2)} zł)\n`;
  message += `🏪 ${shopName}\n`;
  message += `🔗 [View Product](${productUrl})`;

  return message;
}
