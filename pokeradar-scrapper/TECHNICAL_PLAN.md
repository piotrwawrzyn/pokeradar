# Pokemon Product Price Monitor - Technical Plan

## Project Overview

A TypeScript-based web scraper that monitors Pokemon product prices across multiple Polish e-commerce shops and sends Telegram notifications when products meet specified criteria (available + price ≤ max price).

## Technology Stack

### Core Technologies

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript
- **Web Scraping**: Playwright (handles JS-rendered content, reliable for modern e-commerce sites)
- **Notifications**: Telegram Bot API
- **Process Management**: Long-running Node.js process with setInterval

### Dependencies

```json
{
  "playwright": "^1.40.0",
  "dotenv": "^16.3.0",
  "node-telegram-bot-api": "^0.64.0",
  "typescript": "^5.3.0",
  "ts-node": "^10.9.0",
  "@types/node": "^20.10.0"
}
```

## Architecture

### Project Structure

```
pokeradar_2.0/
├── src/
│   ├── config/
│   │   ├── shops/
│   │   │   └── rebel.pl.json          # Shop-specific configuration
│   │   ├── watchlist.json             # Products to monitor
│   │   └── settings.ts                # App settings (intervals, etc.)
│   ├── scrapers/
│   │   ├── BaseScraper.ts             # Abstract base scraper class
│   │   ├── ScraperFactory.ts          # Creates appropriate scraper instances
│   │   └── custom/
│   │       └── RebelScraper.ts        # Custom overrides if needed (future)
│   ├── services/
│   │   ├── NotificationService.ts     # Telegram bot integration
│   │   ├── StateManager.ts            # In-memory state tracking
│   │   └── Logger.ts                  # File-based logging
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces
│   ├── utils/
│   │   ├── priceParser.ts             # Price format transformations
│   │   └── selectorEngine.ts         # Selector resolution with fallbacks
│   └── index.ts                       # Main entry point & orchestration
├── logs/
│   └── app.log                        # Application logs
├── .env                               # Environment variables (gitignored)
├── .env.example                       # Example env file
├── package.json
├── tsconfig.json
└── README.md
```

### Core Components

#### 1. Configuration Schema

**Shop Configuration** (`src/config/shops/rebel.pl.json`)

```typescript
{
  "id": "rebel",
  "name": "Rebel.pl",
  "baseUrl": "https://www.rebel.pl",
  "searchUrl": "/site/search?phrase=",
  "selectors": {
    "searchPage": {
      "article": {
        "type": "css",
        "value": "div.product"
      },
      "title": {
        "type": "css",
        "value": "h3.product__title"
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
        "format": "european"  // Handles: 79,95 zł, 1.299,95 zł, etc.
      },
      "available": {
        "type": "css",
        "value": "span[data-target='#stock-info']",
        "matchText": "Produkt dostępny w magazynie"
      }
    }
  }
}
```

**Watchlist Configuration** (`src/config/watchlist.json`)

```typescript
{
  "products": [
    {
      "id": "black-bolt-white-flare-bundle",
      "name": "Black Bolt and White Flare Booster Bundle",
      "searchPhrases": ["Black Bolt White Flare Booster Bundle"],
      "maxPrice": 190.00
    }
  ]
}
```

**Environment Variables** (`.env`)

```bash
TELEGRAM_BOT_TOKEN=8567378980:AAHszCIZJbuSvL7LsQozsRwzJtgUK3rClFE
TELEGRAM_CHAT_ID=439458898
SCRAPE_INTERVAL_MS=60000  # 1 minute
LOG_LEVEL=info
```

#### 2. Type Definitions

```typescript
// Selector types
type SelectorType = 'css' | 'xpath' | 'text';
type PriceFormat = 'european' | 'us';

interface Selector {
  type: SelectorType;
  value: string | string[]; // Array for fallback selectors
  extract?: 'href' | 'text' | 'innerHTML';
  format?: PriceFormat;
  matchText?: string;
}

// Shop configuration
interface ShopConfig {
  id: string;
  name: string;
  baseUrl: string;
  searchUrl: string;
  selectors: {
    searchPage: {
      article: Selector;
      title: Selector;
      productUrl: Selector;
    };
    productPage: {
      price: Selector;
      available: Selector;
    };
  };
  customScraper?: string; // Optional: path to custom scraper class
}

// Product to monitor
interface WatchlistProduct {
  id: string;
  name: string;
  searchPhrases: string[];
  maxPrice: number;
}

// Scraping result
interface ProductResult {
  productId: string;
  shopId: string;
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
}

// Notification state
interface NotificationState {
  productId: string;
  shopId: string;
  lastNotified: Date | null;
  lastPrice: number | null;
  wasAvailable: boolean;
}
```

#### 3. Selector Engine with Fallbacks

```typescript
class SelectorEngine {
  async extract(page: Page, selector: Selector): Promise<string | null> {
    const selectors = Array.isArray(selector.value) ? selector.value : [selector.value];

    for (const sel of selectors) {
      try {
        const element = await this.findElement(page, selector.type, sel);
        if (element) {
          return await this.extractValue(element, selector.extract);
        }
      } catch (error) {
        // Try next selector in fallback chain
        continue;
      }
    }

    return null; // All selectors failed
  }
}
```

#### 4. Price Parser

```typescript
class PriceParser {
  parseEuropean(priceText: string): number | null {
    // Handles: 79,95 zł | 1.299,95 zł | 79 zł | zł 79,95
    const regex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/;
    const match = priceText.match(regex);

    if (!match) return null;

    // Convert: 1.299,95 → 1299.95
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }
}
```

#### 5. State Manager (In-Memory)

```typescript
class StateManager {
  private state: Map<string, NotificationState> = new Map();

  shouldNotify(productId: string, shopId: string, result: ProductResult): boolean {
    const key = `${productId}:${shopId}`;
    const prevState = this.state.get(key);

    if (!prevState?.lastNotified) {
      return true; // First time seeing this product
    }

    // Reset conditions:
    // 1. Product became unavailable
    if (prevState.wasAvailable && !result.isAvailable) {
      this.resetState(key);
      return false;
    }

    // 2. Price increased
    if (result.price && prevState.lastPrice && result.price > prevState.lastPrice) {
      this.resetState(key);
      return false;
    }

    return false; // Already notified, no reset conditions met
  }

  markNotified(productId: string, shopId: string, result: ProductResult): void {
    const key = `${productId}:${shopId}`;
    this.state.set(key, {
      productId,
      shopId,
      lastNotified: new Date(),
      lastPrice: result.price,
      wasAvailable: result.isAvailable,
    });
  }
}
```

#### 6. Base Scraper (Template Method Pattern)

```typescript
abstract class BaseScraper {
  constructor(
    protected config: ShopConfig,
    protected selectorEngine: SelectorEngine,
    protected priceParser: PriceParser,
  ) {}

  async scrapeProduct(product: WatchlistProduct): Promise<ProductResult> {
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      // Step 1: Search for product
      const productUrl = await this.findProductUrl(page, product);
      if (!productUrl) {
        return this.createNullResult(product);
      }

      // Step 2: Navigate to product page
      await page.goto(productUrl);

      // Step 3: Extract price and availability
      const price = await this.extractPrice(page);
      const isAvailable = await this.checkAvailability(page);

      return {
        productId: product.id,
        shopId: this.config.id,
        productUrl,
        price,
        isAvailable,
        timestamp: new Date(),
      };
    } finally {
      await browser.close();
    }
  }

  // Template methods (can be overridden by custom scrapers)
  protected async findProductUrl(page: Page, product: WatchlistProduct): Promise<string | null> {
    for (const phrase of product.searchPhrases) {
      const url = `${this.config.baseUrl}${this.config.searchUrl}${encodeURIComponent(phrase)}`;
      await page.goto(url);

      const articles = await page.locator(this.config.selectors.searchPage.article.value).all();

      for (const article of articles) {
        const titleText = await this.selectorEngine.extract(
          article,
          this.config.selectors.searchPage.title,
        );

        if (this.titleMatches(titleText, product.name)) {
          return await this.selectorEngine.extract(
            article,
            this.config.selectors.searchPage.productUrl,
          );
        }
      }
    }

    return null;
  }

  protected async extractPrice(page: Page): Promise<number | null> {
    const priceText = await this.selectorEngine.extract(
      page,
      this.config.selectors.productPage.price,
    );

    if (!priceText) return null;

    const format = this.config.selectors.productPage.price.format || 'european';
    return this.priceParser.parse(priceText, format);
  }

  protected async checkAvailability(page: Page): Promise<boolean> {
    const availText = await this.selectorEngine.extract(
      page,
      this.config.selectors.productPage.available,
    );

    const expectedText = this.config.selectors.productPage.available.matchText;
    return availText?.includes(expectedText) || false;
  }

  protected titleMatches(titleText: string | null, productName: string): boolean {
    if (!titleText) return false;
    return titleText.toLowerCase().includes(productName.toLowerCase());
  }
}
```

#### 7. Notification Service

```typescript
class NotificationService {
  private bot: TelegramBot;

  constructor(
    token: string,
    private chatId: string,
  ) {
    this.bot = new TelegramBot(token, { polling: false });
  }

  async sendAlert(
    product: WatchlistProduct,
    result: ProductResult,
    shop: ShopConfig,
  ): Promise<void> {
    const message = this.formatMessage(product, result, shop);
    await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
  }

  private formatMessage(
    product: WatchlistProduct,
    result: ProductResult,
    shop: ShopConfig,
  ): string {
    return `
🎯 *Product Available!*

📦 ${product.name}
🏪 Shop: ${shop.name}
💰 Price: ${result.price?.toFixed(2)} zł (max: ${product.maxPrice.toFixed(2)} zł)
✅ Status: Available

🔗 [View Product](${result.productUrl})
    `.trim();
  }
}
```

#### 8. Logger

```typescript
class Logger {
  private logFile = path.join(__dirname, '../../logs/app.log');

  info(message: string, meta?: any): void {
    this.write('INFO', message, meta);
  }

  error(message: string, error?: any): void {
    this.write('ERROR', message, error);
  }

  private write(level: string, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}`;
    const fullLog = meta ? `${logLine} ${JSON.stringify(meta)}\n` : `${logLine}\n`;

    fs.appendFileSync(this.logFile, fullLog);
    console.log(logLine);
  }
}
```

#### 9. Main Orchestrator

```typescript
class PriceMonitor {
  private shops: ShopConfig[];
  private products: WatchlistProduct[];
  private stateManager: StateManager;
  private notificationService: NotificationService;
  private logger: Logger;

  async runScanCycle(): Promise<void> {
    this.logger.info('Starting scan cycle', {
      shops: this.shops.length,
      products: this.products.length,
    });

    for (const shop of this.shops) {
      for (const product of this.products) {
        try {
          const scraper = ScraperFactory.create(shop);
          const result = await scraper.scrapeProduct(product);

          this.logger.info('Scanned product', {
            product: product.id,
            shop: shop.id,
            price: result.price,
            available: result.isAvailable,
          });

          // Check if we should notify
          if (
            result.isAvailable &&
            result.price &&
            result.price <= product.maxPrice &&
            this.stateManager.shouldNotify(product.id, shop.id, result)
          ) {
            await this.notificationService.sendAlert(product, result, shop);
            this.stateManager.markNotified(product.id, shop.id, result);

            this.logger.info('Notification sent', {
              product: product.id,
              shop: shop.id,
              price: result.price,
            });
          }
        } catch (error) {
          this.logger.error('Error scanning product', {
            product: product.id,
            shop: shop.id,
            error: error.message,
          });
        }
      }
    }

    this.logger.info('Scan cycle completed');
  }

  start(): void {
    this.logger.info('Price monitor started', {
      interval: process.env.SCRAPE_INTERVAL_MS,
    });

    // Run immediately on start
    this.runScanCycle();

    // Then run every interval
    setInterval(() => this.runScanCycle(), parseInt(process.env.SCRAPE_INTERVAL_MS || '60000'));
  }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Foundation)

**Goal**: Set up project skeleton and basic scraping capability

- [ ] Initialize TypeScript project with dependencies
- [ ] Create folder structure
- [ ] Define TypeScript interfaces/types
- [ ] Implement SelectorEngine with fallback support
- [ ] Implement PriceParser with European format support
- [ ] Create BaseScraper class
- [ ] Set up Logger service

### Phase 2: Rebel.pl Integration (First Shop)

**Goal**: Get end-to-end working with rebel.pl

- [ ] Create rebel.pl shop configuration
- [ ] Create sample watchlist with 1-2 products
- [ ] Set up .env file with Telegram credentials
- [ ] Implement NotificationService
- [ ] Implement StateManager
- [ ] Manual testing: verify selectors work on rebel.pl
- [ ] Manual testing: verify price parsing
- [ ] Manual testing: verify Telegram notifications

### Phase 3: Orchestration (Make it Run)

**Goal**: Connect all pieces and run continuously

- [ ] Implement ScraperFactory
- [ ] Implement PriceMonitor main class
- [ ] Create index.ts entry point
- [ ] Test full scan cycle manually
- [ ] Test state management (don't re-notify)
- [ ] Test reset conditions (price increase, availability change)

### Phase 4: Extensibility (Custom Scrapers)

**Goal**: Support shops that need custom logic

- [ ] Document how to create custom scraper class
- [ ] Create example custom scraper (if rebel.pl needs it)
- [ ] Test custom scraper override mechanism

### Phase 5: Future Enhancements (Post-MVP)

**Goal**: Improve reliability and features

- [ ] Replace in-memory state with JSON file persistence
- [ ] Add basic integration tests
- [ ] Support additional price formats
- [ ] Add more shops
- [ ] Error handling improvements (retry logic, circuit breakers)
- [ ] Add health check endpoint
- [ ] Containerize with Docker

## Testing Strategy

### Manual Testing (Primary)

- Test rebel.pl selectors on real pages
- Verify price parsing with various formats
- Test Telegram notifications
- Verify state management behavior

### Basic Integration Tests (Optional)

- Test price parser with known inputs
- Test selector extraction on sample HTML
- Test notification formatting

### Ongoing Validation

- Monitor logs for errors
- Verify notifications arrive as expected
- Check state resets work correctly

## Configuration Examples

### Adding a New Shop

1. Create `src/config/shops/newshop.json`
2. Define selectors using the schema
3. (Optional) Create custom scraper if needed in `src/scrapers/custom/NewShopScraper.ts`
4. Shop will be automatically loaded on next restart

### Adding a New Product

1. Edit `src/config/watchlist.json`
2. Add product with id, name, searchPhrases, maxPrice
3. Product will be monitored on next scan cycle

## Error Handling Strategy

### Scraping Errors

- Log error with shop, product, and error details
- Continue to next product/shop
- Retry on next scan cycle (1 minute later)

### Notification Errors

- Log error
- Don't mark as notified (will retry next cycle)

### Critical Errors

- Log error
- Process continues running
- Manual intervention required for fixes

## Deployment

### Development

```bash
npm install
cp .env.example .env
# Edit .env with credentials
npm run dev
```

### Production

```bash
npm install
npm run build
npm start
```

### Future: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Success Criteria

✅ Monitors rebel.pl every 1 minute
✅ Finds products from watchlist via search
✅ Extracts price and availability correctly
✅ Sends Telegram notification when criteria met
✅ Only notifies once (doesn't spam)
✅ Resets state when product becomes unavailable or price increases
✅ Logs all operations and errors to file
✅ Easy to add new shops via configuration
✅ Supports custom scrapers for complex sites

## Open Questions / Future Considerations

1. **Rate Limiting**: Should we add delays between requests to avoid being blocked?
2. **User Agent Rotation**: Do we need to randomize user agents?
3. **Proxy Support**: For scaling to many shops, may need proxy rotation
4. **Database**: When to migrate from in-memory to persistent state?
5. **Monitoring**: Should we add a health check endpoint or status dashboard?
6. **Multiple Search Results**: Currently takes first match - should we check all results?
