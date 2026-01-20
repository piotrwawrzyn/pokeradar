# Pokemon Price Monitor - Project Context

## Project Overview

A TypeScript-based web scraper that monitors Pokemon product prices across multiple Polish e-commerce shops and sends Telegram notifications when products are available at desired prices.

## Tech Stack

- **Runtime**: Node.js v18+
- **Language**: TypeScript
- **Web Scraping**: Playwright (headless Chrome)
- **Notifications**: Telegram Bot API
- **Testing**: Node.js native test runner + tsx
- **Architecture**: Template Method Pattern with extensible scrapers

## Key Concepts

### 1. Shop Configuration System

Each shop has a JSON config in `src/config/shops/` defining:
- Base URL and search URL
- CSS selectors for search page (article, productUrl)
- CSS selectors for product page (title, price, availability)
- Optional custom scraper reference

**Example: rebel.json**
```json
{
  "searchPage": {
    "article": "div.product",
    "productUrl": "a" (extracts href)
  },
  "productPage": {
    "title": "h1.product__title",
    "price": "span.price" (european format),
    "available": ["span[data-target='#stock-info']"] (array for fallbacks)
  }
}
```

### 2. Scraping Flow

1. **Search**: Navigate to search URL with phrase → Find first article → Extract product URL
2. **Product Page**: Navigate to product URL → Extract title, price, availability
3. **Notification**: If available AND price ≤ maxPrice → Send Telegram alert (once)

### 3. State Management (In-Memory)

Tracks notification state per product/shop combination:
- Only notifies once per product
- Resets when: product becomes unavailable OR price increases
- After reset, will notify again when criteria met

### 4. Selector System

**Fallback Support**: Array of selectors tried in order
```json
"available": [
  {"value": "span[data-target='#stock-info']", "matchText": "In stock"},
  {"value": "span", "matchText": "Pre-order"}
]
```

**Selector Types**: css, xpath, text
**Extract Types**: href, text, innerHTML

### 5. Price Parsing

**European Format** (default for Polish shops):
- Handles: `79,95 zł`, `1.299,95 zł`, `79 zł`
- Converts to decimal: `79.95`

## Project Structure

```
src/
├── config/
│   ├── shops/          # Shop JSON configs (rebel.json)
│   └── watchlist.json  # Products to monitor
├── scrapers/
│   ├── BaseScraper.ts  # Template method base class
│   ├── ScraperFactory.ts
│   └── custom/         # Custom scraper overrides
├── services/
│   ├── Logger.ts       # File + console logging
│   ├── NotificationService.ts  # Telegram bot
│   ├── StateManager.ts # Notification state
│   └── PriceMonitor.ts # Main orchestrator
├── types/
│   └── index.ts        # TypeScript interfaces
└── utils/
    ├── priceParser.ts  # Price format parsing
    └── selectorEngine.ts  # Selector extraction with fallbacks

tests/
├── fixtures/           # Test data (stable URLs, search phrases)
├── helpers/
│   └── testHelpers.ts  # ShopTester class
└── shops/
    └── rebel.test.ts   # Integration tests per shop
```

## Key Files

### BaseScraper.ts
Template method pattern with protected methods:
- `findProductUrl()` - Search and extract product URL
- `navigateToProductPage()` - Navigate to product
- `extractTitle()` - Extract product title
- `extractPrice()` - Extract and parse price
- `checkAvailability()` - Check if available
- Override in custom scrapers for complex sites

### PriceMonitor.ts
Main orchestrator that:
- Loads shop configs and watchlist
- Runs scan cycles every X ms (default: 60000)
- Creates scrapers via factory
- Checks state manager before notifying
- Sends Telegram alerts

### SelectorEngine.ts
Handles selector extraction with:
- Fallback selector arrays
- CSS, XPath, text selector types
- Attribute extraction (href, text, innerHTML)
- Works with Page or Locator

## Configuration Files

### .env
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
SCRAPE_INTERVAL_MS=60000
LOG_LEVEL=debug|info
```

### watchlist.json
```json
{
  "products": [
    {
      "id": "unique-id",
      "name": "Product Name",
      "searchPhrases": ["phrase 1", "phrase 2"],
      "maxPrice": 250.00
    }
  ]
}
```

## Commands

```bash
npm run dev       # Run with debug logging (continuous)
npm run build     # Compile TypeScript
npm start         # Run compiled version
npm test          # Run all shop integration tests
npm run test:rebel # Run specific shop test
```

## Integration Tests

Each shop has:
1. **Test fixture** (`tests/fixtures/shopname.json`) with:
   - `stableProductUrl` - Popular product unlikely to be removed
   - `searchPhrase` - Query that returns results

2. **Test file** (`tests/shops/shopname.test.ts`) testing:
   - Product page: title, price, availability extraction
   - Search page: articles found, URL extraction

**Purpose**: Validate selectors work before deploying bot

## Adding a New Shop

1. Create `src/config/shops/newshop.json` with selectors
2. Create `tests/fixtures/newshop.json` with test data
3. Copy `tests/shops/rebel.test.ts` → `newshop.test.ts`
4. Run `npm test` to verify
5. Add products to watchlist with shop-specific search phrases

## Custom Scrapers

For sites needing custom logic:

```typescript
// src/scrapers/custom/CustomShopScraper.ts
export class CustomShopScraper extends BaseScraper {
  protected async findProductUrl(page: Page, product: WatchlistProduct): Promise<string | null> {
    // Custom search logic
  }
}
```

Reference in config:
```json
{
  "customScraper": "./custom/CustomShopScraper"
}
```

## Important Design Decisions

1. **Title from Product Page**: Title extracted from product page (not search results) for accuracy
2. **First Article Wins**: Takes first search result (assumes specific search phrases)
3. **In-Memory State**: Simple for now, easy to upgrade to persistent storage
4. **No Title Matching**: Relies on search phrase specificity, doesn't validate title matches
5. **Fallback Selectors**: Arrays of selectors for robustness (try each until one works)
6. **Multiple Availability Types**: Supports both "in stock" and "pre-order" as available

## Common Patterns

### European Price Format
Polish sites use: `123,45 zł` (comma decimal, space, currency)
Parser handles: thousands separator, missing decimals, various spacing

### Availability Detection
Multiple selectors with different text matches:
- "Produkt dostępny w magazynie" (in stock)
- "Produkt w przedsprzedaży" (pre-order)

### State Reset Logic
```
if (wasAvailable && !isAvailable) → reset
if (lastPrice < currentPrice) → reset
After reset → will notify again when criteria met
```

## Future Enhancements

- [ ] Persistent state (JSON file or SQLite)
- [ ] More price formats (US, other EU countries)
- [ ] Rate limiting / request throttling
- [ ] Health check endpoint
- [ ] Web dashboard
- [ ] Docker containerization
- [ ] Proxy rotation for scale

## Debugging Tips

1. **Check logs**: `logs/app.log` has detailed scraping info
2. **Debug mode**: Set `LOG_LEVEL=debug` in `.env`
3. **Test selectors**: Run `npm run test:rebel` to validate
4. **Manual test**: Use browser DevTools to verify selectors match
5. **State issues**: StateManager is in-memory, restart clears state

## Notes for Claude

- **Config-driven**: Most shops work with just JSON config, no code changes
- **Extensible**: Can override any BaseScraper method for custom behavior
- **Test-first**: Always create integration test when adding new shop
- **Price format**: European format is default, specify in config if different
- **Availability**: Support arrays for multiple availability indicators
- **Search phrases**: Should be specific enough to return correct product first
