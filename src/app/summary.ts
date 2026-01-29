/**
 * Summary entry point.
 * Queries MongoDB for best prices and sends Telegram summary message.
 */

import * as dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

// Infrastructure
import { connectDB, disconnectDB } from '../infrastructure/database';

// Shared
import { MongoWatchlistRepository, MongoProductResultRepository } from '../shared/repositories';
import { ProductSummary } from '../shared/types';

// Summary
import { formatSummaryFromResults } from '../summary/message-formatter';

// Load environment variables
dotenv.config();

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

    // Find best price for each product (single batch query)
    const productIds = products.map((p) => p.id);
    const bestOffersMap = await resultsRepo.getBestOffersForProducts(productIds);

    // Build summaries using the unified type
    // Map semantics: has key + value = available offer, has key + null = fresh but not found, no key = no data
    const summaries: ProductSummary[] = products.map((product) => {
      if (!bestOffersMap.has(product.id)) {
        // No fresh data at all
        return { product, result: null };
      }
      const offer = bestOffersMap.get(product.id);
      if (offer) {
        return { product, result: offer };
      }
      // Fresh data exists but nothing available
      return {
        product,
        result: {
          productId: product.id,
          shopId: '',
          productUrl: '',
          price: null,
          isAvailable: false,
          timestamp: new Date(),
        },
      };
    });

    // Format and send summary via Telegram
    const bot = new TelegramBot(telegramToken, { polling: false });
    const message = formatSummaryFromResults(summaries);

    await bot.sendMessage(telegramChatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });

    const available = summaries.filter((s) => s.result?.isAvailable).length;
    console.log(`Summary sent: ${available}/${products.length} products available`);
  } finally {
    await disconnectDB();
  }
}

main().catch((error) => {
  console.error('Error sending summary:', error);
  process.exit(1);
});
