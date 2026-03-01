# Pokeradar — Claude Context

## What this project is

A TypeScript monorepo that monitors Pokémon product prices across Polish e-commerce shops and sends Discord/Telegram notifications when products are available at target prices. It is a multi-user, multi-tenant system.

## Monorepo structure

```
packages/shared/          # Shared types, DB models, shop configs, utilities
pokeradar-api/            # Express REST API
pokeradar-client/         # React SPA (Vite)
pokeradar-scrapper/       # Scraping engine — scheduled job (Cheerio + Playwright)
pokeradar-notifications/  # Notification delivery daemon (Telegram + Discord)
```

---

## Services overview

### packages/shared (`@pokeradar/shared`)

Shared library consumed by all backend services. Never runs standalone.

**Key contents:**
- `src/database/models/` — Mongoose schemas for all 8 MongoDB collections
- `src/config/shops/` — 17 Polish e-commerce shop configs (JSON)
- `src/logger/` — Structured `Logger` class (file + console output)
- `src/shops/` — Utilities to load shop configs at runtime
- `src/types/` — Shared TypeScript interfaces (`ShopConfig`, `ProductResult`, etc.)

**Build requirement:** The scrapper reads from `dist/`, not source. Always run `npm run build:shared` after editing shop configs or shared types.

---

### pokeradar-api

Express REST API. Handles user-facing operations — watchlist management, product browsing, user account settings.

**Stack:** Express · Clerk (auth) · MongoDB/Mongoose · Zod (validation) · Helmet + rate limiting · Cloudinary + Sharp (images)

**Modules (`src/modules/`):**

| Module | Purpose |
| --- | --- |
| `auth` | `GET /auth/me` — current user info |
| `products` | Browse products, price history |
| `product-sets` | Product categorization (booster boxes, tins, etc.) |
| `watchlist` | CRUD for user watch entries (maxPrice, availability filters) |
| `users` | User profile, link Telegram/Discord channels |
| `admin` | Admin-only management |

**Auth:** Clerk JWT. `clerkId` extracted from token, used to scope all queries.

**Entry point:** `src/server.ts` → `src/app.ts`

---

### pokeradar-client

React SPA. User interface for watchlist management and notification settings.

**Stack:** React 19 · Vite · TypeScript · TailwindCSS 4 · Radix UI · React Router 7 · TanStack Query 5 · Clerk · Axios

**Key directories:**
- `src/components/` — UI primitives (`ui/`), feature components grouped by domain
- `src/pages/` — Watchlist, Settings, Admin
- `src/hooks/` — Custom hooks for API calls and state
- `src/api/` — Axios instance with Clerk token injection
- `src/context/` — `AuthContext` (current user + auth state)

**Entry point:** `src/main.tsx`

---

### pokeradar-scrapper

Scheduled job that scrapes shops and creates notification documents. Runs once per cron trigger, then exits.

**Stack:** Cheerio (static HTML) · Playwright (JS-rendered sites) · Axios · Fuzzball (fuzzy matching) · MongoDB

**Execution flow:**
1. Connect to MongoDB
2. Load all shops + watchlist entries
3. For each product × shop: search → extract URL, price, availability → visit product page if needed
4. Compare scraped data against user watch entries
5. Write `ProductResult` and `Notification` docs to MongoDB
6. Disconnect and exit

**Engines:**

| Engine | When to use |
| --- | --- |
| `cheerio` (default) | Static HTML — fast, no browser overhead |
| `playwright` | JavaScript-rendered pages or `customScraper` |

**Entry point:** `src/app/index.ts`

---

### pokeradar-notifications

Long-running daemon that delivers queued notifications to users via Telegram and Discord.

**Stack:** node-telegram-bot-api · Discord.js 14 · MongoDB change streams

**Execution flow:**
1. Connect to MongoDB
2. Start Telegram and Discord bots
3. Recover any pending notifications from previous run
4. Watch MongoDB change stream for new `Notification` documents
5. Deliver via rate-limited per-platform channels
6. Update `Notification.deliveries[].status` with result
7. Graceful shutdown on `SIGTERM` / `SIGINT`

**Entry point:** `src/app/index.ts`

---

## Database models

All Mongoose schemas live in `packages/shared/src/database/models/`.

| Model | Purpose | Key fields |
| --- | --- | --- |
| `User` | Registered user | `clerkId` (unique), `telegram.channelId`, `discord.channelId` |
| `WatchlistProduct` | Product definition | `id`, `name`, `imageUrl`, `productSetId`, `productTypeId` |
| `UserWatchEntry` | User's watch filter | `userId`, `productId`, `maxPrice`, availability flags |
| `ProductResult` | Scraped price snapshot (TTL 24 h) | `productId`, `shopId`, `price`, `isAvailable`, `timestamp` |
| `Notification` | Pending/delivered notification (TTL 30 d) | `userId`, `payload`, `deliveries[].{channel, status}` |
| `NotificationState` | Tracks "already notified" state | `userId`, `productId`, `notified`, `lastPrice` |
| `ProductSet` | Product category | `id`, `name`, `imageUrl` |
| `ProductType` | Product sub-type | `id`, `name` |

---

## Data flow

```
Client (React)
  │  HTTP + Clerk JWT
  ▼
API (Express)
  │  reads/writes User, WatchlistProduct, UserWatchEntry
  ▼
MongoDB ◄─── Scrapper (cron job)
               reads WatchlistEntries + shop configs
               writes ProductResult, Notification
                        │
                        │ change stream
                        ▼
               Notifications (daemon)
               reads Notification
               delivers via Telegram / Discord
               updates Notification.deliveries[].status
```

---

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

---

## Shop configuration

See **[docs/shop-config.md](docs/shop-config.md)** for the full reference.

It covers every config field (`engine`, `fetchingTier`, `antiBot`, `directHitPattern`, `titleFromUrl`, `customScraper`), every selector type (`css`, `text`, `xpath`, `json-attribute`), all selector options (`extract`, `format`, `matchSelf`, `attribute`, `jsonFilter`, `jsonExpect`, `condition`), and common patterns. This is the primary reference when adding a new shop or debugging a broken one.

---

## Code quality

Write code as if the next person reading it has never seen the codebase before.

**Principles to follow:**

- **DRY** — extract repeated logic into a named function or utility; never copy-paste business logic
- **SOLID** — single responsibility per class/module, depend on abstractions not concretions, keep interfaces small
- **KISS** — prefer the simplest solution that correctly solves the problem; add complexity only when needed
- **Self-descriptive code** — variable and function names should make intent clear without needing a comment; `getUserMaxPrice()` beats `getUmp()`
- **Reusability** — put logic that could be shared in `packages/shared` or a local `shared/` directory; don't duplicate across modules
- **Comments only where necessary** — explain *why*, not *what*; delete comments that just restate the code; never add block comments for obvious operations
- **No over-engineering** — don't add abstractions, generics, or configuration for hypothetical future needs; solve the problem at hand
- **Consistent style** — follow the patterns already in the file you are editing; match naming conventions, file structure, and module organization

---

## Engines

| Engine              | When to use                                               |
| ------------------- | --------------------------------------------------------- |
| `cheerio` (default) | Static HTML shops — fast, no browser overhead             |
| `playwright`        | JavaScript-rendered shops, or when `customScraper` is set |

---

## Scrapping flow (high level)

1. Search page → find article elements → extract product URL + optional price/availability
2. If search-page data is complete (price + availability both found), skip product page visit
3. Otherwise navigate to product page → extract price + check `available` selectors
4. Compare result against watchlist → trigger notification if criteria met

---

## Testing

### Running tests

```bash
npm test                    # run all tests across all workspaces
npm run test:api            # run API tests only
npm run test:client         # run client tests only
npm run test:scrapper       # run scrapper tests only
npm run test:notifications  # run notifications tests only
```

Each submodule also supports `npm run test:watch` for TDD workflows.

### Frameworks

| Module                  | Framework | Environment                  |
| ----------------------- | --------- | ---------------------------- |
| pokeradar-api           | Jest      | Node + MongoDB Memory Server |
| pokeradar-client        | Vitest    | happy-dom + MSW              |
| pokeradar-scrapper      | Jest      | Node                         |
| pokeradar-notifications | Jest      | Node + MongoDB Memory Server |

Vitest is used only in the client (natural fit for a Vite project). All backend services use Jest with `ts-jest`.

### Test structure conventions

**API & Notifications** use a top-level `tests/` folder:

```
<service>/
  tests/
    setup.ts              # global setup (DB, mocks, env vars)
    helpers/              # reusable test utilities (optional)
    <module>/
      <module>.test.ts    # tests grouped by feature/module
```

**Scrapper** uses co-located `__tests__/` folders next to source code:

```
pokeradar-scrapper/src/
  matching/
    __tests__/            # tests live next to the code they test
      normalize.test.ts
      pipeline.test.ts
      ...
    normalize.ts
    pipeline.ts
```

**Client** tests live co-located in `__tests__/` folders next to the source they test:

```
pokeradar-client/src/
  components/
    ui/__tests__/         # UI component tests
    admin/__tests__/      # admin component tests
    notifications/__tests__/  # notification component tests
    products/__tests__/   # product component tests
    watchlist/__tests__/  # watchlist component tests
  hooks/__tests__/        # hook tests
  lib/__tests__/          # utility tests
  pages/__tests__/        # page-level tests
  __tests__/              # shared test infra (setup.ts, test-utils.tsx, mocks/)
```

### File naming

- Test files: `*.test.ts` (backend) or `*.test.tsx` (client components)
- Setup files: `setup.ts`
- Helpers: `helpers/` directory with descriptive names

### Key testing patterns

- **API tests:** Use `supertest` against the Express app, `mongodb-memory-server` for an isolated DB, and Bearer tokens for auth (token value = clerkId for multi-user isolation).
- **Client tests:** Use `@testing-library/react` with `renderWithProviders()` helper. MSW intercepts HTTP requests. Clerk hooks are mocked globally.
- **Notifications tests:** Use `mongodb-memory-server` and `jest.fn()` mocks for platform adapters (Telegram, Discord).

### Testing rules

1. **Always write tests for new functionality.** Every new API endpoint, component, hook, or service method should have corresponding tests.
2. **Always update tests when changing existing behavior.** If you modify a function's contract, update its tests to match.
3. **Opportunistic testing.** When you notice untested code while working on a nearby feature or fix, add tests for it. Treat it as tech debt worth paying down incrementally.
4. **Tests must pass before merging.** Never merge code with failing tests. CI will enforce this.
5. **Test behavior, not implementation.** Focus on what the code does (inputs → outputs, side effects), not how it does it internally.
6. **Keep tests independent.** Each test should set up its own data and not depend on other tests' state. Use `beforeEach` for setup, `afterEach` for cleanup.
7. **Use existing helpers.** Reuse `createTestUser()`, `seedProducts()`, `renderWithProviders()`, and MSW handlers instead of reinventing setup in each test.
8. **Create test helpers to reduce boilerplate.** When you notice repeated setup or assertion patterns across tests, extract them into shared helpers (e.g., in `tests/helpers/` or `src/__tests__/test-utils.tsx`).
