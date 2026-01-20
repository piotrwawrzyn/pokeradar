# Adding a New Shop

This guide walks you through adding support for a new e-commerce shop to the Pokemon Price Monitor bot.

## Overview

Adding a new shop involves:
1. Creating a shop configuration file with CSS selectors
2. Creating a test fixture for integration tests
3. Creating integration tests
4. Running tests to validate selectors
5. (Optional) Creating a custom scraper if needed

**Time estimate**: 15-30 minutes for a simple shop

## Prerequisites

- Node.js and npm installed
- Repository cloned locally
- Basic understanding of CSS selectors
- Browser DevTools knowledge (for inspecting HTML)

## Step 1: Research the Shop Website

Before writing any code, you need to understand the shop's HTML structure.

### What You Need to Find

1. **Search Results Page**:
   - How to construct a search URL
   - CSS selector for product articles/cards
   - CSS selector for product URL within an article

2. **Product Page**:
   - CSS selector for product title
   - CSS selector for price
   - CSS selector(s) for availability status
   - Price format (European: `79,95 zł`, US: `$79.95`)

### How to Find Selectors

1. Go to the shop website
2. Open browser DevTools (F12)
3. Navigate to a search results page
4. Right-click on a product card → Inspect
5. Find a unique CSS selector for:
   - The product card container
   - The link to the product
6. Navigate to a product page
7. Right-click on title, price, availability → Inspect
8. Note the CSS selectors

**Pro tip**: Use DevTools Console to test selectors:
```javascript
// Test if selector works
document.querySelector('span.price')
// Test if it returns multiple elements
document.querySelectorAll('div.product')
```

## Step 2: Create Shop Configuration

Create a new JSON file in `src/config/shops/` named after the shop (e.g., `example-shop.json`).

### Basic Configuration Template

```json
{
  "id": "example-shop",
  "name": "Example Shop",
  "baseUrl": "https://www.example-shop.com",
  "searchUrl": "/search?q=",
  "selectors": {
    "searchPage": {
      "article": {
        "type": "css",
        "value": "div.product-card"
      },
      "productUrl": {
        "type": "css",
        "value": "a.product-link",
        "extract": "href"
      }
    },
    "productPage": {
      "title": {
        "type": "css",
        "value": "h1.product-title"
      },
      "price": {
        "type": "css",
        "value": "span.product-price",
        "format": "european"
      },
      "available": [
        {
          "type": "text",
          "value": "In Stock"
        },
        {
          "type": "text",
          "value": "Pre-order"
        }
      ]
    }
  }
}
```

### Configuration Fields Explained

#### Top Level

- **id**: Unique identifier (lowercase, kebab-case)
- **name**: Display name
- **baseUrl**: Shop's base URL (no trailing slash)
- **searchUrl**: Search endpoint (will be appended to baseUrl)

#### Search Page Selectors

- **article**: Selector for product cards/articles on search results
  - `type`: Usually `"css"`
  - `value`: CSS selector for product container

- **productUrl**: Selector for product link within article
  - `type`: Usually `"css"`
  - `value`: CSS selector for link element
  - `extract`: `"href"` to get the URL

#### Product Page Selectors

- **title**: Selector for product title
  - `type`: `"css"`, `"xpath"`, or `"text"`
  - `value`: Selector value

- **price**: Selector for product price
  - `type`: Usually `"css"`
  - `value`: CSS selector
  - `format`: `"european"` (79,95 zł) or `"us"` ($79.95)

- **available**: Availability indicators (array for fallbacks)
  - Can use CSS selectors or text-based selectors
  - Multiple selectors are tried in order
  - First match wins

### Selector Types

**CSS Selector** (most common):
```json
{
  "type": "css",
  "value": "span.price"
}
```

**Text Selector** (searches for text content):
```json
{
  "type": "text",
  "value": "In Stock"
}
```

**XPath Selector** (advanced):
```json
{
  "type": "xpath",
  "value": "//span[@class='price']"
}
```

### Fallback Selectors

Use arrays when there are multiple possible selectors:

```json
"available": [
  {
    "type": "text",
    "value": "In Stock"
  },
  {
    "type": "text",
    "value": "Available"
  },
  {
    "type": "css",
    "value": "span.in-stock"
  }
]
```

The scraper tries each selector in order until one succeeds.

### Extract Types

For `productUrl`, you can extract different attributes:

- `"href"` - Extract href attribute (most common for links)
- `"text"` - Extract text content (default)
- `"innerHTML"` - Extract HTML content

## Step 3: Create Test Fixture

Create `tests/fixtures/shopname.json` with test data:

```json
{
  "stableProductUrl": "https://www.example-shop.com/products/popular-item",
  "searchPhrase": "pokemon"
}
```

**stableProductUrl**: A popular product unlikely to be removed
**searchPhrase**: A search term that returns results

**Tips for choosing test data**:
- Pick evergreen products (Pokemon base sets, popular items)
- Choose products regularly in stock
- Use generic search phrases that return multiple results

## Step 4: Create Integration Tests

Copy `tests/shops/rebel.test.ts` and modify it:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { test } from 'node:test';
import * as assert from 'node:assert';
import { ShopConfig } from '../../src/types';
import { ShopTester } from '../helpers/testHelpers';

// Load shop config
const configPath = path.join(__dirname, '../../src/config/shops/example-shop.json');
const config: ShopConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Load test fixture
const fixturePath = path.join(__dirname, '../fixtures/example-shop.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

test('example-shop.com integration tests', async (t) => {
  const tester = new ShopTester(config);

  await t.before(async () => {
    await tester.setup();
  });

  await t.after(async () => {
    await tester.teardown();
  });

  await t.test('Product Page - Price Extraction', async () => {
    const result = await tester.testPriceExtraction(fixture.stableProductUrl);

    assert.strictEqual(result.passed, true, result.error || 'Price extraction failed');
    assert.ok(result.value?.price, 'Price should be extracted');
    assert.ok(result.value?.price > 0, 'Price should be greater than 0');
  });

  await t.test('Product Page - Availability Extraction', async () => {
    const result = await tester.testAvailabilityExtraction(fixture.stableProductUrl);

    assert.strictEqual(result.passed, true, result.error || 'Availability extraction failed');
    assert.ok(result.value?.availabilityText, 'Availability text should be extracted');
  });

  await t.test('Product Page - Title Extraction', async () => {
    const result = await tester.testTitleExtraction(fixture.stableProductUrl);

    assert.strictEqual(result.passed, true, result.error || 'Title extraction failed');
    assert.ok(result.value?.title, 'Title should be extracted');
  });

  await t.test('Search Page - Articles Found', async () => {
    const result = await tester.testSearchArticles(fixture.searchPhrase);

    assert.strictEqual(result.passed, true, result.error || 'Search articles test failed');
    assert.ok(result.value?.articleCount > 0, 'Should find at least one article');
  });

  await t.test('Search Page - URL Extraction', async () => {
    const result = await tester.testSearchUrlExtraction(fixture.searchPhrase);

    assert.strictEqual(result.passed, true, result.error || 'URL extraction from search failed');
    assert.ok(result.value?.productUrl, 'Product URL should be extracted');
    assert.ok(
      result.value?.productUrl.startsWith('http'),
      'Product URL should be a valid URL'
    );
  });
});
```

## Step 5: Run Tests

Test your configuration:

```bash
# Run all tests
npm test

# Run specific shop test
node --import tsx --test tests/shops/example-shop.test.ts
```

### Understanding Test Output

**Success**:
```
✓ Product Page - Price Extraction
✓ Product Page - Availability Extraction
✓ Product Page - Title Extraction
✓ Search Page - Articles Found
✓ Search Page - URL Extraction
```

**Failure**:
```
✗ Product Page - Price Extraction
  Error: Price element not found
```

### Debugging Failed Tests

If tests fail:

1. **Check the error message** - It tells you what went wrong
2. **Verify selectors in browser** - Use DevTools to test CSS selectors
3. **Check the HTML structure** - The website might have changed
4. **Try different selectors** - Use fallback arrays
5. **Check network tab** - Ensure the page loads correctly

**Common issues**:
- Selector too specific (add fallbacks)
- Selector not specific enough (returns wrong element)
- JavaScript-rendered content (wait longer or use different selector)
- Dynamic class names (use more stable selectors)

## Step 6: Add Shop to Watchlist

Once tests pass, add products for this shop:

```json
{
  "products": [
    {
      "id": "pokemon-booster-example-shop",
      "name": "Pokemon Booster Pack",
      "searchPhrases": ["Pokemon Booster Pack"],
      "maxPrice": 50.00
    }
  ]
}
```

**Search phrase tips**:
- Be specific enough to find the right product
- The scraper takes the first search result
- Test the search phrase on the website first

## Step 7: Test Live (Optional)

Run the bot locally to test live scraping:

```bash
npm run dev
```

Watch the logs to ensure:
- Product is found via search
- Product page loads correctly
- Price is extracted
- Availability is detected

Press Ctrl+C to stop.

## Advanced: Custom Scrapers

If a shop has complex requirements that can't be handled with JSON config, create a custom scraper.

### When to Use Custom Scrapers

- JavaScript-heavy sites requiring special interactions
- Complex authentication flows
- Dynamic content loading
- Special price formats
- Multi-step checkout detection

### Creating a Custom Scraper

1. Create `src/scrapers/custom/ExampleShopScraper.ts`:

```typescript
import { Page } from 'playwright';
import { BaseScraper } from '../BaseScraper';
import { WatchlistProduct } from '../../types';

export class ExampleShopScraper extends BaseScraper {
  /**
   * Override to implement custom search logic
   */
  protected async findProductUrl(
    page: Page,
    product: WatchlistProduct
  ): Promise<string | null> {
    // Custom search implementation
    // Example: Click buttons, handle popups, etc.

    // Call parent implementation if using default logic
    return super.findProductUrl(page, product);
  }

  /**
   * Override to implement custom price extraction
   */
  protected async extractPrice(page: Page): Promise<number | null> {
    // Custom price extraction
    const priceText = await page.locator('.custom-price').textContent();
    if (!priceText) return null;

    // Custom parsing
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    return isNaN(price) ? null : price;
  }

  /**
   * Override to implement custom availability check
   */
  protected async checkAvailability(page: Page): Promise<boolean> {
    // Custom availability logic
    // Example: Check multiple indicators, API calls, etc.

    return super.checkAvailability(page);
  }
}
```

2. Reference in shop config:

```json
{
  "id": "example-shop",
  "customScraper": "./custom/ExampleShopScraper",
  ...
}
```

### Available Methods to Override

From `BaseScraper.ts`:

- `findProductUrl(page, product)` - Search and extract product URL
- `navigateToProductPage(page, productUrl)` - Navigate to product
- `extractTitle(page)` - Extract product title
- `extractPrice(page)` - Extract and parse price
- `checkAvailability(page)` - Check if product is available
- `normalizeUrl(url)` - Normalize relative/absolute URLs

## Troubleshooting

### Selector Not Found

**Problem**: Selector returns no elements

**Solutions**:
1. Verify selector in DevTools Console
2. Check if content is dynamically loaded (increase wait time)
3. Use more general selector
4. Add fallback selectors

### Wrong Element Selected

**Problem**: Selector returns wrong element

**Solutions**:
1. Make selector more specific
2. Use child/descendant combinators
3. Add attribute selectors
4. Use `:first-child` or `:nth-child()`

### Price Parsing Fails

**Problem**: Price extracted but parsing fails

**Solutions**:
1. Check price format in config (`european` vs `us`)
2. Verify price text format (commas, dots, currency symbols)
3. Add custom price parser in custom scraper

### Availability Always False

**Problem**: Available products show as unavailable

**Solutions**:
1. Check availability text exactly matches
2. Use text selector instead of CSS
3. Add multiple availability indicators
4. Check if availability is dynamically loaded

## Best Practices

### Selector Strategy

1. **Prefer class selectors** over IDs (IDs might be dynamic)
2. **Use semantic classes** (`.product-price` vs `.text-red-500`)
3. **Avoid deep nesting** (keep selectors simple)
4. **Add fallbacks** for critical selectors
5. **Test on multiple products** to ensure selectors are stable

### Testing

1. **Test with real products** that are actually available
2. **Test search with generic terms** that return results
3. **Run tests before deploying** to catch broken selectors
4. **Re-run tests periodically** to catch website changes

### Maintenance

1. **Document unusual selectors** in comments
2. **Keep shop configs simple** when possible
3. **Use custom scrapers** only when necessary
4. **Monitor logs** for scraping failures
5. **Update selectors promptly** when websites change

## Example: Real World Shop

Let's add support for a hypothetical shop "PokeCards.pl":

### 1. Research

Visit PokeCards.pl and find:
- Search URL: `https://pokecards.pl/search?query=`
- Product card: `<div class="card">`
- Product link: `<a class="card__link">`
- Product title: `<h1 class="product-name">`
- Price: `<span class="product-price">79,95 zł</span>`
- Availability: `<div class="stock">W magazynie</div>`

### 2. Create Config

`src/config/shops/pokecards.json`:

```json
{
  "id": "pokecards",
  "name": "PokeCards.pl",
  "baseUrl": "https://pokecards.pl",
  "searchUrl": "/search?query=",
  "selectors": {
    "searchPage": {
      "article": {
        "type": "css",
        "value": "div.card"
      },
      "productUrl": {
        "type": "css",
        "value": "a.card__link",
        "extract": "href"
      }
    },
    "productPage": {
      "title": {
        "type": "css",
        "value": "h1.product-name"
      },
      "price": {
        "type": "css",
        "value": "span.product-price",
        "format": "european"
      },
      "available": [
        {
          "type": "text",
          "value": "W magazynie"
        }
      ]
    }
  }
}
```

### 3. Create Fixture

`tests/fixtures/pokecards.json`:

```json
{
  "stableProductUrl": "https://pokecards.pl/products/charizard-vmax",
  "searchPhrase": "pokemon"
}
```

### 4. Create Test

Copy `tests/shops/rebel.test.ts` → `tests/shops/pokecards.test.ts` and update references.

### 5. Run Tests

```bash
node --import tsx --test tests/shops/pokecards.test.ts
```

### 6. Add to Watchlist

```json
{
  "products": [
    {
      "id": "charizard-pokecards",
      "name": "Charizard VMAX",
      "searchPhrases": ["Charizard VMAX"],
      "maxPrice": 100.00
    }
  ]
}
```

Done! The bot now monitors PokeCards.pl.

## Checklist

Before considering a shop complete:

- [ ] Shop config created in `src/config/shops/`
- [ ] Test fixture created in `tests/fixtures/`
- [ ] Integration test created in `tests/shops/`
- [ ] All tests passing (`npm test`)
- [ ] Tested with real search phrase
- [ ] Product added to watchlist
- [ ] Verified bot can scrape product locally
- [ ] Committed to git
- [ ] Deployed to Railway

## Getting Help

If you get stuck:

1. Check existing shop configs for examples
2. Review `BaseScraper.ts` for available methods
3. Read Playwright documentation for advanced selectors
4. Check project issues on GitHub
5. Test selectors in browser DevTools first

## Related Documentation

- [Project Context](../.claude/context.md) - Architecture overview
- [Test README](../tests/README.md) - Testing guide
- [Types](../src/types/index.ts) - TypeScript interfaces
- [BaseScraper](../src/scrapers/BaseScraper.ts) - Template method implementation
