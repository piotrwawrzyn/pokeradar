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

**Client** tests live inside `src/__tests__/` mirroring the source tree:

```
pokeradar-client/src/__tests__/
  setup.ts                # global setup (Clerk mock, MSW)
  test-utils.tsx          # renderWithProviders() helper
  mocks/                  # MSW handlers & mock data
  components/             # component tests
  hooks/                  # hook tests
  lib/                    # utility tests
  pages/                  # page-level tests
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
