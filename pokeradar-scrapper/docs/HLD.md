# Pokeradar — High-Level Design

## What Is Pokeradar?

Pokeradar is a Pokemon TCG price-monitoring platform. It tracks prices of Pokemon products across 25 Polish e-commerce shops and alerts users via Telegram when a product they're watching drops to their desired price. The system has three services sharing a single MongoDB database.

---

## Architecture Overview

```
                        ┌──────────────────┐
                        │   pokeradar-client  │
                        │   React 19 SPA    │
                        │   :5173           │
                        └────────┬─────────┘
                                 │ HTTP (Axios)
                                 ▼
                        ┌──────────────────┐
                        │   pokeradar-api     │
                        │   Express REST    │
                        │   :3000           │
                        └────────┬─────────┘
                                 │ Mongoose
                                 ▼
                        ┌──────────────────┐
                        │   MongoDB         │
                        │   (shared)        │
                        └────────┬─────────┘
                                 ▲ Mongoose
                                 │
                        ┌────────┴─────────┐
                        │ pokeradar-scrapper  │
                        │ Cron worker       │──── Telegram Bot API
                        │ (single-cycle)    │     (push notifications)
                        └──────────────────┘
```

---

## Services

### 1. pokeradar-scrapper (Price Scanner + Notifier)

**Purpose:** Scrapes product prices from 25 shops, stores results, and sends Telegram alerts to users whose price thresholds are met.

**Type:** Cron-triggered Node.js process. Runs a single scan cycle then exits.

**Tech:** TypeScript, Cheerio, Playwright, Mongoose ^9.1.5, node-telegram-bot-api

**Key flow:**
1. Connect to MongoDB, load product catalog and shop configs
2. Preload all user watch entries + notification targets (2 DB queries)
3. Load notification states for subscribed products (1 DB query)
4. Filter catalog to only products with active subscribers
5. Scrape each product across all shops (Cheerio for static HTML, Playwright for JS-rendered sites)
6. For each result, check against all watching users' `maxPrice` thresholds
7. Enqueue Telegram notifications (rate-limited at 25 msgs/sec)
8. Flush results + notification states to DB (1 bulkWrite)

**Total DB queries per cycle: 4**, regardless of user count.

**Shops monitored (25):** pokesmart, rebel, basanti, loficards, strefakart, battlestash, flamberg, tcgtrener, tcglove, lootquest, xzone, cardfan, strefamtg, xjoy, poketrader, boosterpoint, rozetka, tcgumisia, przyczolek, heartspub, lochyikoty, letsgotry, skladgier, strefamarzen, pegaz

---

### 2. pokeradar-api (REST Backend)

**Purpose:** User-facing API for authentication, watchlist management, and price data access.

**Type:** Stateless Express HTTP server. JWT auth, no sessions.

**Tech:** TypeScript, Express 4, Mongoose ^9.1.5, Passport (Google OAuth), Zod, Helmet, CORS

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/google` | No | Redirect to Google OAuth |
| GET | `/auth/google/callback` | No | OAuth callback, generate JWT, redirect to frontend |
| GET | `/auth/me` | JWT | Current user profile |
| GET | `/products` | No | Product catalog |
| GET | `/products/:id/prices` | No | Latest prices per shop (last hour) |
| GET | `/product-sets` | No | TCG set groupings |
| GET | `/watchlist` | JWT | User's watched products + current best prices |
| POST | `/watchlist` | JWT | Add product to watchlist with maxPrice |
| PATCH | `/watchlist/:id` | JWT | Update maxPrice or toggle active |
| DELETE | `/watchlist/:id` | JWT | Remove from watchlist |
| GET | `/users/me` | JWT | Profile + Telegram link status |
| POST | `/users/me/telegram/link-token` | JWT | Generate UUID for Telegram linking |
| DELETE | `/users/me/telegram` | JWT | Unlink Telegram |

---

### 3. pokeradar-client (Web Frontend)

**Purpose:** User interface for browsing products, managing watchlists, and configuring notifications.

**Type:** Single-page application.

**Tech:** React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5, React Router v7

**Routes:**

| Path | Page | Auth | Description |
|------|------|------|-------------|
| `/` | Watchlist | No | Product catalog grouped by TCG set, watchlist toggles, price display |
| `/ustawienia` | Settings | Yes | Profile info, Telegram notification setup |
| `/auth/callback` | Auth Callback | No | Captures JWT from OAuth redirect |

**Theme:** Pikachu dark — charcoal (#1a1a2e) backgrounds, amber (#FFC107) accents.

---

## Shared Database

All three services connect to the same MongoDB instance. Collection ownership:

| Collection | Owner | Other readers |
|------------|-------|---------------|
| `watchlistproducts` | scrapper | api |
| `productresults` | scrapper (write), 24h TTL | api (read) |
| `notificationstates` | scrapper | — |
| `users` | api | scrapper (for Telegram chatId) |
| `userwatchentries` | api | scrapper (for notification fan-out) |
| `productsets` | api | — |

---

## Key Data Models

**WatchlistProduct** — Global product catalog. Defines what to scrape (search phrases, name). Products can be `disabled`.

**ProductResult** — One record per product/shop/hour. Auto-expires after 24h via TTL index. Used by the API to serve current prices.

**User** — Google OAuth account. Stores `telegramChatId` (set by bot linking) and `telegramLinkToken` (single-use UUID).

**UserWatchEntry** — Per-user per-product. Stores `maxPrice` (individual notification threshold) and `isActive` toggle.

**NotificationState** — Per-user/product/shop triple. Prevents duplicate notifications. Resets when product becomes unavailable or price increases.

---

## Cross-Service Flows

### User Registration + Login
```
Client → GET /auth/google → Google OAuth → GET /auth/google/callback
→ API creates/finds User → generates JWT → redirects to Client /auth/callback?token=xxx
→ Client stores token in localStorage → Axios interceptor adds Bearer header
```

### Telegram Linking
```
Client → POST /users/me/telegram/link-token → API generates UUID, stores on User
→ Client displays: "Send /link <token> to @tcg_pokemon_bot"
→ User sends command in Telegram → Scrapper bot sets telegramChatId, clears token
→ GET /users/me now returns telegramLinked: true
```

### Price Alert (end-to-end)
```
Scrapper runs scan cycle → scrapes product at shop → price=85zł, available=true
→ Dispatcher checks: User A watches this product with maxPrice=100zł
→ 85 <= 100 and user has telegramChatId → enqueue notification
→ After cycle: rate-limited Telegram send → User A gets alert in Telegram
→ NotificationState marked → won't re-notify until price increases or product unavailable
```

### Browsing Products (no auth)
```
Client → GET /products → API reads watchlistproducts collection → returns catalog
Client → GET /products/:id/prices → API aggregates productresults (last hour, best per shop)
```

---

## Scale Characteristics

Designed for up to 25K users:

| Resource | At 25K users | Notes |
|----------|-------------|-------|
| Watch entry preload | ~250K entries, ~25 MB | 1 DB query |
| User target preload | ~25K entries, ~2.5 MB | 1 DB query |
| Notification states | <100K realistic, ~15 MB | Only exists for sent notifications |
| DB queries per scan cycle | **4 total** | Independent of user count |
| Telegram send rate | 25 msgs/sec | Under Telegram's 30/sec limit |
| Worst-case notification time | ~17 minutes for 25K messages | Rarely all users notified at once |

---

## Tech Stack Summary

| | Scrapper | API | Client |
|--|---------|-----|--------|
| Runtime | Node.js 18+ | Node.js 18+ | Browser |
| Language | TypeScript | TypeScript | TypeScript |
| Framework | — | Express 4 | React 19 + Vite |
| DB | Mongoose 9 | Mongoose 9 | — |
| Auth | — | Passport + JWT | Axios interceptor |
| Styling | — | — | Tailwind v4 + shadcn/ui |
| Testing | — | Jest + supertest | Vitest + RTL + MSW |
