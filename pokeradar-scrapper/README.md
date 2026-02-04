# Pokemon Price Monitor

A TypeScript-based web scraper that monitors Pokemon product prices across multiple Polish e-commerce shops and sends Telegram notifications when products meet specified criteria.

## Features

- Monitor multiple products across multiple shops
- Configurable price thresholds
- Telegram notifications when products are available at desired prices
- Smart notification system (only notifies once, resets on price increase or availability change)
- Extensible architecture with support for custom scrapers
- Detailed logging for debugging

## Prerequisites

- Node.js v18 or higher
- A Telegram bot token and chat ID

## Installation

1. Clone or navigate to this directory

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Telegram credentials:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
SCRAPE_INTERVAL_MS=60000
LOG_LEVEL=info
```

## Configuration

### Adding Products to Monitor

Edit `src/config/watchlist.json`:

```json
{
  "products": [
    {
      "id": "unique-product-id",
      "name": "Product Name",
      "searchPhrases": ["Search Phrase 1", "Search Phrase 2"],
      "maxPrice": 100.00
    }
  ]
}
```

### Adding New Shops

Create a new JSON file in `src/config/shops/` (e.g., `newshop.json`):

```json
{
  "id": "shopid",
  "name": "Shop Name",
  "baseUrl": "https://www.example.com",
  "searchUrl": "/search?q=",
  "selectors": {
    "searchPage": {
      "article": {
        "type": "css",
        "value": "div.product"
      },
      "title": {
        "type": "css",
        "value": "h2.product-title"
      },
      "productUrl": {
        "type": "css",
        "value": "a",
        "extract": "href"
      }
    },
    "productPage": {
      "price": {
        "type": "css",
        "value": "span.price",
        "format": "european"
      },
      "available": {
        "type": "css",
        "value": "span.stock",
        "matchText": "In stock"
      }
    }
  }
}
```

### Selector Fallbacks

You can specify multiple selectors as fallbacks:

```json
{
  "type": "css",
  "value": ["div.price", "span.price", "p.price"]
}
```

The scraper will try each selector in order until one succeeds.

## Running

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## How It Works

1. **Scan Cycle**: Every 60 seconds (configurable), the monitor:
   - Iterates through all shops and products
   - Searches for each product on each shop
   - Checks price and availability

2. **Notification Logic**: A Telegram notification is sent when:
   - Product is available
   - Price ≤ max price
   - No notification was sent previously (or state was reset)

3. **State Reset**: The notification state resets when:
   - Product becomes unavailable (next time it's available, notify again)
   - Price increases (next time it drops to criteria, notify again)

## Project Structure

```
pokeradar_2.0/
├── src/
│   ├── config/
│   │   ├── shops/           # Shop configurations
│   │   └── watchlist.json   # Products to monitor
│   ├── scrapers/
│   │   ├── BaseScraper.ts   # Base scraper class
│   │   └── ScraperFactory.ts
│   ├── services/
│   │   ├── Logger.ts
│   │   ├── NotificationService.ts
│   │   ├── StateManager.ts
│   │   └── PriceMonitor.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── priceParser.ts
│   │   └── selectorEngine.ts
│   └── index.ts
├── logs/
│   └── app.log
└── .env
```

## Extending with Custom Scrapers

For shops that need custom logic beyond configuration, create a custom scraper:

1. Create a new file in `src/scrapers/custom/`:

```typescript
import { BaseScraper } from '../BaseScraper';
import { Page, WatchlistProduct } from '../../types';

export class CustomShopScraper extends BaseScraper {
  // Override methods as needed
  protected async findProductUrl(page: Page, product: WatchlistProduct): Promise<string | null> {
    // Custom implementation
    return null;
  }
}
```

2. Reference it in the shop config:

```json
{
  "id": "customshop",
  "customScraper": "./custom/CustomShopScraper"
}
```

## Logging

Logs are written to:
- Console (stdout/stderr)
- `logs/app.log` file

Set `LOG_LEVEL=debug` in `.env` for verbose logging.

## Troubleshooting

### No products found
- Check that selectors in shop config are correct
- Use browser DevTools to inspect the shop's HTML
- Enable debug logging to see what's being extracted

### Telegram notifications not working
- Verify bot token and chat ID are correct
- Check that the bot has permission to send messages to the chat
- Look for errors in the logs

### Scraping fails
- Some shops may have bot detection
- Try adjusting wait times in BaseScraper
- Consider adding custom scraper logic

## Future Enhancements

- [ ] Persistent state storage (JSON file or database)
- [ ] Web dashboard for monitoring
- [ ] Support for more price formats
- [ ] Rate limiting and request throttling
- [ ] Docker containerization
- [ ] Integration tests

## License

ISC
