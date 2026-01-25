import * as dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import {
  connectDB,
  disconnectDB,
  MongoWatchlistRepository,
  MongoProductResultRepository
} from './repositories';
import { WatchlistProductInternal, ProductResult } from './types';

// Load environment variables
dotenv.config();

interface BestPrice {
  product: WatchlistProductInternal;
  result: ProductResult | null;
}

/**
 * Formats the summary message for Telegram.
 */
function formatSummaryMessage(bestPrices: BestPrice[]): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('pl-PL');

  let message = `📊 *Price Summary*\n`;
  message += `📅 ${dateStr} ${timeStr}\n`;
  message += `─────────────────────\n\n`;

  const available = bestPrices.filter(bp => bp.result?.isAvailable && bp.result?.price !== null);
  const notFound = bestPrices.filter(bp => !bp.result || !bp.result.isAvailable || bp.result.price === null);

  // Available items section
  if (available.length > 0) {
    message += `✅ *Available Items (${available.length})*\n\n`;

    for (const bp of available) {
      const priceStr = bp.result!.price!.toFixed(2);
      const maxPriceStr = bp.product.price.max.toFixed(2);
      const meetsMax = bp.result!.price! <= bp.product.price.max;
      const priceIndicator = meetsMax ? '💚' : '🔴';

      message += `📦 *${bp.product.name}*\n`;
      message += `${priceIndicator} ${priceStr} zł (max: ${maxPriceStr} zł)\n`;
      message += `🏪 ${bp.result!.shopId}\n`;
      message += `🔗 [View Product](${bp.result!.productUrl})\n\n`;
    }
  }

  // Not found items section
  if (notFound.length > 0) {
    message += `❌ *Not Found (${notFound.length})*\n\n`;

    for (const bp of notFound) {
      message += `• ${bp.product.name}\n`;
    }
  }

  if (bestPrices.length === 0) {
    message += `_No products in watchlist_\n`;
  }

  message += `\n─────────────────────`;

  return message;
}

/**
 * Main entry point for sending price summary.
 * Queries MongoDB for best prices and sends Telegram message.
 */
async function main() {
  // Validate environment variables
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const mongodbUri = process.env.MONGODB_URI;

  if (!telegramToken) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not set');
    process.exit(1);
  }

  if (!telegramChatId) {
    console.error('ERROR: TELEGRAM_CHAT_ID is not set');
    process.exit(1);
  }

  if (!mongodbUri) {
    console.error('ERROR: MONGODB_URI is not set');
    process.exit(1);
  }

  // Connect to MongoDB
  await connectDB(mongodbUri);

  try {
    const watchlistRepo = new MongoWatchlistRepository();
    const resultsRepo = new MongoProductResultRepository();

    // Get all products
    const products = await watchlistRepo.getAll();

    if (products.length === 0) {
      console.log('No products in watchlist');
      return;
    }

    // Find best price for each product
    const bestPrices: BestPrice[] = [];

    for (const product of products) {
      const bestResult = await resultsRepo.getBestPrice(product.id);
      bestPrices.push({
        product,
        result: bestResult
      });
    }

    // Send summary via Telegram
    const bot = new TelegramBot(telegramToken, { polling: false });
    const message = formatSummaryMessage(bestPrices);

    await bot.sendMessage(telegramChatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    const available = bestPrices.filter(bp => bp.result?.isAvailable).length;
    console.log(`Summary sent: ${available}/${products.length} products available`);
  } finally {
    await disconnectDB();
  }
}

main().catch(error => {
  console.error('Error sending summary:', error);
  process.exit(1);
});
