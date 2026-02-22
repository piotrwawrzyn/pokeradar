# Shop Configuration Reference

Shop configs live in `packages/shared/src/config/shops/<id>.json`.

> **Important:** After editing any shop config, run `npm run build:shared` from the repo root — the scrapper reads from the compiled `dist/` copy, not the source files directly.

---

## Top-level fields

```json
{
  "id": "shopname",
  "name": "Shop Display Name",
  "disabled": false,
  "engine": "cheerio",
  "fetchingTier": "fast",
  "antiBot": { ... },
  "baseUrl": "https://shop.example.com/",
  "searchUrl": "/search?q={query}",
  "directHitPattern": "/product/",
  "customScraper": "./custom/ShopNameScraper",
  "selectors": { ... }
}
```

| Field              | Type                                                     | Required | Default     | Description                                                                                                                                     |
| ------------------ | -------------------------------------------------------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | string                                                   | yes      | —           | Unique identifier, used in logs and DB                                                                                                          |
| `name`             | string                                                   | yes      | —           | Human-readable display name                                                                                                                     |
| `disabled`         | boolean                                                  | no       | `false`     | Exclude shop from all scraping runs                                                                                                             |
| `engine`           | `"cheerio"` \| `"playwright"`                            | no       | `"cheerio"` | Scraping engine. Use `playwright` for JS-rendered sites                                                                                         |
| `fetchingTier`     | `"super-fast"` \| `"fast"` \| `"slow"` \| `"super-slow"` | no       | `"fast"`    | Groups shops in cron scheduling; filtered by `FETCHING_TIER` env var                                                                            |
| `antiBot`          | object                                                   | no       | —           | Rate-limiting and proxy config (see below)                                                                                                      |
| `baseUrl`          | string                                                   | yes      | —           | Root URL of the shop, used as prefix for relative URLs                                                                                          |
| `searchUrl`        | string                                                   | yes      | —           | Search URL template; `{query}` is replaced with the search phrase                                                                               |
| `directHitPattern` | string                                                   | no       | —           | Regex that matches product page URLs; when the search redirects directly to a product, the scraper detects this and skips search-result parsing |
| `customScraper`    | string                                                   | no       | —           | Relative path to a custom scraper class; forces Playwright engine                                                                               |
| `selectors`        | object                                                   | yes      | —           | DOM selectors for search and product pages (see below)                                                                                          |

---

## `antiBot`

```json
"antiBot": {
  "requestDelayMs": 1000,
  "maxConcurrency": 1,
  "useProxy": true
}
```

| Field            | Type    | Default                   | Description                                                                                                |
| ---------------- | ------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `requestDelayMs` | number  | `0`                       | Base delay in ms before each HTTP request. Actual delay is randomised ±30% to avoid patterns               |
| `maxConcurrency` | number  | env `PRODUCT_CONCURRENCY` | Max simultaneous product-page requests for this shop                                                       |
| `useProxy`       | boolean | `false`                   | Route requests through the rotating proxy configured in env. Shop is skipped if proxy is globally disabled |

---

## `selectors`

```json
"selectors": {
  "searchPage": { ... },
  "productPage": { ... }
}
```

### `selectors.searchPage`

Controls how the scraper reads search result pages.

| Field          | Type                   | Required | Description                                                                                                                                                      |
| -------------- | ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `article`      | Selector               | yes      | Repeating element that wraps one search result. All other search-page selectors are evaluated within this element                                                |
| `productUrl`   | Selector               | yes      | Link to the product page. Use `"extract": "href"`                                                                                                                |
| `title`        | Selector               | no       | Product title within the article. If omitted and `titleFromUrl` is false, title matching falls back to the product page                                          |
| `titleFromUrl` | boolean                | no       | When `true`, derives the title from the product URL slug (hyphens → spaces) instead of reading a DOM element. Useful when search pages don't show full titles    |
| `price`        | Selector               | no       | Price within the article. If both `price` and an availability selector are found, the scraper uses search-page data directly and skips visiting the product page |
| `available`    | Selector \| Selector[] | no       | If any selector matches, the product is marked available on the search page                                                                                      |
| `unavailable`  | Selector \| Selector[] | no       | If any selector matches (and `available` didn't), the product is marked unavailable. When neither matches, availability is resolved from the product page        |

### `selectors.productPage`

Controls how the scraper reads individual product pages.

| Field       | Type                   | Required | Description                                                                                                                              |
| ----------- | ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `title`     | Selector               | no       | Used to validate a direct-hit result (when `directHitPattern` matched). The scraped title is compared against the expected product title |
| `price`     | Selector               | yes      | Product price                                                                                                                            |
| `available` | Selector \| Selector[] | yes      | Checked in order; if any selector matches, product is available. Supports all selector types including `json-attribute`                  |

---

## Selector object

Every selector is a JSON object with the following fields:

```json
{
  "type": "css",
  "value": "button.add-to-cart",
  "extract": "text",
  "format": "european",
  "matchSelf": false
}
```

| Field       | Type                                                 | Required | Description                                                                                                                                                                              |
| ----------- | ---------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`      | string                                               | yes      | Selector syntax — see types below                                                                                                                                                        |
| `value`     | string \| string[]                                   | yes      | The selector pattern. When an array, each entry is tried in order until one matches (fallback chain)                                                                                     |
| `extract`   | `"text"` \| `"href"` \| `"innerHTML"` \| `"ownText"` | no       | What to extract from the matched element. Default: `"text"`                                                                                                                              |
| `format`    | `"european"` \| `"us"`                               | no       | Price parsing format. `european`: `1.299,95 zł` → `1299.95`. `us`: `1,299.95` → `1299.95`. Only relevant for price selectors                                                             |
| `matchSelf` | boolean                                              | no       | When `true`, checks whether the article element itself matches the selector, rather than searching its descendants. Useful for search-page availability selectors on the article wrapper |

### Selector types

#### `css`

Standard CSS selector evaluated by Cheerio or Playwright.

```json
{ "type": "css", "value": "button[name='add-to-cart']" }
```

#### `text`

Case-insensitive text content search across the subtree.

```json
{ "type": "text", "value": "Produkt dostępny" }
```

#### `xpath`

XPath expression (supported in both engines but rarely needed).

```json
{ "type": "xpath", "value": "//button[@class='buy']" }
```

#### `json-attribute`

Reads a JSON-encoded HTML attribute, evaluates a dot-notation path on each array item, and aggregates results. Used when availability data is embedded in a data attribute rather than expressed via DOM structure (e.g. WooCommerce variable products).

Additional fields required:

| Field        | Type                              | Required | Description                                                                                                                                       |
| ------------ | --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attribute`  | string                            | yes      | Name of the HTML attribute to read (e.g. `"data-product_variations"`)                                                                             |
| `jsonFilter` | string                            | yes      | Dot-notation path evaluated on each item (e.g. `"is_in_stock"`, `"stock.available"`)                                                              |
| `jsonExpect` | any                               | no       | Expected value for strict equality check (`=== jsonExpect`). When omitted, uses JS truthiness instead. Use this for string enums like `"instock"` |
| `condition`  | `"some"` \| `"every"` \| `"none"` | no       | How to aggregate results across array items. Default: `"some"`                                                                                    |

```json
{
  "type": "json-attribute",
  "value": "form[data-product_variations]",
  "attribute": "data-product_variations",
  "jsonFilter": "is_in_stock",
  "condition": "some"
}
```

```json
{
  "type": "json-attribute",
  "value": "[data-inventory]",
  "attribute": "data-inventory",
  "jsonFilter": "stock_status",
  "jsonExpect": "instock",
  "condition": "some"
}
```

---

## Array selectors

Any selector field that accepts `Selector | Selector[]` can take an array. In `available` arrays, selectors are evaluated in order and the first one that resolves to `true` short-circuits the rest.

```json
"available": [
  {
    "type": "css",
    "value": "form.cart:not(.variations_form) button.single_add_to_cart_button"
  },
  {
    "type": "json-attribute",
    "value": "form[data-product_variations]",
    "attribute": "data-product_variations",
    "jsonFilter": "is_in_stock",
    "condition": "some"
  }
]
```

The `value` field on a single selector can also be an array — this is a fallback within one logical selector (tries each CSS string until one matches an element):

```json
{
  "type": "css",
  "value": ["div.products article", "ul.items li.product"]
}
```

---

## Common patterns

### Detect WooCommerce variable product availability

Variable product pages embed stock data in `data-product_variations`. Use `json-attribute` as a fallback after the simple-product button check (which is scoped to `form.cart:not(.variations_form)` to avoid matching on variable product pages in raw HTML):

```json
"available": [
  { "type": "css", "value": "form.cart:not(.variations_form) button.single_add_to_cart_button" },
  { "type": "json-attribute", "value": "form[data-product_variations]", "attribute": "data-product_variations", "jsonFilter": "is_in_stock", "condition": "some" }
]
```

### Detect direct-hit search redirect

Some shops redirect the search page directly to the product when there's a single result. Set `directHitPattern` to a regex that matches product URLs:

```json
"directHitPattern": "/produkt/"
```

The scraper checks the current URL after navigation; if it matches, it skips search-result parsing and validates the title against `selectors.productPage.title`.

### Title from URL

When search results don't display useful titles, set `titleFromUrl: true` under `searchPage`. The scraper extracts the last path segment of the product URL and converts hyphens to spaces.

### Anti-bot with concurrency control

For rate-limited shops, combine `requestDelayMs` with `maxConcurrency: 1` and set `fetchingTier: "super-slow"` so the cron runs this shop in a batch separate from faster ones:

```json
"fetchingTier": "super-slow",
"antiBot": {
  "requestDelayMs": 2000,
  "maxConcurrency": 1
}
```
