# Pokeradar — Claude Context

## What this project is

A TypeScript monorepo that monitors Pokémon product prices across Polish e-commerce shops and sends Discord notifications when products are available at target prices.

## Monorepo structure

```
packages/shared/          # Shared types, shop configs, utilities
  src/config/shops/       # One JSON file per shop
  dist/                   # Compiled output — read by the scrapper at runtime
pokeradar-scrapper/       # Scraping engine (Cheerio + Playwright)
pokeradar-api/            # REST API
pokeradar-client/         # Frontend
pokeradar-notifications/  # Discord notification service
```

## Key workflows

**Adding or editing a shop config:**
Edit `packages/shared/src/config/shops/<id>.json`, then run:

```bash
npm run build:shared
```

The scrapper reads from `packages/shared/dist/`, not the source. Without rebuilding, changes have no effect.

**Testing a shop:**

```bash
cd pokeradar-scrapper
npm run baseline:check -- <shop-id>   # compare against saved baseline
npm run baseline -- <shop-id>         # record new baseline
```

**Running the scrapper locally:**

```bash
cd pokeradar-scrapper
npm run dev
```

## Shop configuration

See **[docs/shop-config.md](docs/shop-config.md)** for the full reference.

It covers every config field (`engine`, `fetchingTier`, `antiBot`, `directHitPattern`, `titleFromUrl`, `customScraper`), every selector type (`css`, `text`, `xpath`, `json-attribute`), all selector options (`extract`, `format`, `matchSelf`, `attribute`, `jsonFilter`, `jsonExpect`, `condition`), and common patterns. This is the primary reference when adding a new shop or debugging a broken one.

## Engines

| Engine              | When to use                                               |
| ------------------- | --------------------------------------------------------- |
| `cheerio` (default) | Static HTML shops — fast, no browser overhead             |
| `playwright`        | JavaScript-rendered shops, or when `customScraper` is set |

## Scrapping flow (high level)

1. Search page → find article elements → extract product URL + optional price/availability
2. If search-page data is complete (price + availability both found), skip product page visit
3. Otherwise navigate to product page → extract price + check `available` selectors
4. Compare result against watchlist → trigger notification if criteria met

## Important gotchas

- **WooCommerce variable products:** The add-to-cart button is always present in raw HTML; JS-added classes like `wc-variation-selection-needed` are invisible to Cheerio. Use `form.cart:not(.variations_form)` to scope to simple products, and `json-attribute` on `data-product_variations` for variable ones. See [docs/shop-config.md](docs/shop-config.md) for the full pattern.
- **`disabled: true`** in a shop config silently excludes it from all runs — check this first when a shop produces no results.
- **`fetchingTier`** is filtered by the `FETCHING_TIER` env var in cron jobs. Running locally without this var processes all tiers.
