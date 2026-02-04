# Pokebot Client — React Frontend Implementation Plan

## Tech Stack
- **React 19 + Vite + TypeScript**
- **shadcn/ui + Tailwind CSS v4** (components copied into `src/components/ui/`)
- **TanStack Query v5** (server state), **React Context** (auth only)
- **React Router v7**, **Axios**, **Lucide React** (icons), **Sonner** (toasts)
- **Pikachu dark theme**: charcoal backgrounds, amber/yellow (#FFC107) accents

## Project Structure

```
pokebot-client/
├── .env                          # VITE_API_BASE_URL=http://localhost:3000
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── components.json               # shadcn/ui config
├── src/
│   ├── main.tsx                  # Providers: QueryClient, AuthProvider, Router
│   ├── App.tsx                   # Routes + MainLayout
│   ├── api/
│   │   ├── client.ts             # Axios instance + JWT interceptor
│   │   ├── products.api.ts
│   │   ├── product-sets.api.ts
│   │   ├── watchlist.api.ts
│   │   ├── users.api.ts
│   │   └── auth.api.ts
│   ├── types/
│   │   ├── product.types.ts
│   │   ├── product-set.types.ts
│   │   ├── watchlist.types.ts
│   │   ├── user.types.ts
│   │   └── api.types.ts
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-products.ts
│   │   ├── use-product-sets.ts
│   │   ├── use-watchlist.ts
│   │   ├── use-user-profile.ts
│   │   ├── use-telegram.ts
│   │   └── use-debounce.ts
│   ├── context/
│   │   └── auth-context.tsx
│   ├── lib/
│   │   ├── utils.ts              # shadcn cn() helper
│   │   └── format.ts             # formatPLN(), formatDate()
│   ├── pages/
│   │   ├── watchlist-page.tsx    # Main page (/)
│   │   ├── settings-page.tsx     # User settings (/ustawienia) — profile + notifications
│   │   └── auth-callback-page.tsx # /auth/callback — captures JWT
│   ├── components/
│   │   ├── ui/                   # shadcn primitives (auto-generated)
│   │   ├── layout/
│   │   │   ├── header.tsx        # Logo, login/user menu (no tab nav needed — single main page)
│   │   │   └── main-layout.tsx
│   │   ├── auth/
│   │   │   ├── google-login-button.tsx
│   │   │   ├── user-menu.tsx
│   │   │   └── auth-guard.tsx    # Shows login prompt if not authenticated
│   │   ├── products/
│   │   │   ├── product-catalog.tsx   # Groups products by sets, handles sorting
│   │   │   ├── product-set-group.tsx # Collapsible set section
│   │   │   ├── product-grid.tsx
│   │   │   └── product-card.tsx      # Image, name, price, toggle, maxPrice input
│   │   ├── watchlist/
│   │   │   ├── watchlist-toggle.tsx
│   │   │   ├── max-price-input.tsx   # Debounced + validated
│   │   │   └── login-prompt.tsx
│   │   └── notifications/
│   │       ├── notification-channel-list.tsx
│   │       ├── notification-channel-card.tsx  # Generic wrapper: icon, switch, status
│   │       └── telegram/
│   │           ├── telegram-setup.tsx
│   │           ├── telegram-instructions.tsx  # Numbered steps
│   │           └── telegram-status.tsx        # Linked badge + unlink button
│   └── styles/
│       └── globals.css           # Tailwind directives + Pikachu theme CSS vars
```

## Routing

| Path | Page | Auth |
|------|------|------|
| `/` | WatchlistPage | No (toggles disabled for guests) |
| `/ustawienia` | SettingsPage | Yes (AuthGuard redirects to login) |
| `/auth/callback` | AuthCallbackPage | No |

Settings page is accessed via **user dropdown menu** (gear icon / "Ustawienia" option), not a top-level tab. This keeps the main nav clean — only the watchlist/catalog is in the primary navigation.

## Key Design Decisions

### Auth Flow
1. User clicks "Zaloguj przez Google" → browser navigates to `API/auth/google`
2. Google OAuth → API generates JWT → redirects to `/auth/callback?token=xxx`
3. `AuthCallbackPage` reads token from URL, stores in localStorage, fetches `/auth/me`, redirects to `/`
4. `AuthProvider` on mount: reads token from localStorage, validates via `/auth/me`
5. Axios interceptor: attaches `Authorization: Bearer <token>`, catches 401 → logout

### Watchlist Tab (main page)
- Products grouped by `productSetId`, sets sorted by `releaseDate` descending
- Products without a set go into "Inne" category at the bottom
- **Prices shown for all products** — `GET /products` returns `currentBestPrice` for each product. Used for both display and maxPrice validation
- Toggle switch: ON → `POST /watchlist { productId, maxPrice }` with an initial maxPrice prompt; OFF → `DELETE /watchlist/:id`
- `maxPrice` input: debounced (500ms), auto-saves via `PATCH /watchlist/:id`
- Validation: `maxPrice > currentBestPrice` → inline error, PATCH not sent
- Disabled products (product.disabled=true) shown with badge, toggle disabled

#### Watchlist disabled states (with clear informational messages)

**State 1: Not logged in**
- All watchlist toggles are visually disabled (grayed out)
- Prominent banner/alert at the top of the catalog:
  - "Zaloguj sie, aby skonfigurowac swoja liste obserwowanych"
  - Includes a "Zaloguj przez Google" button directly in the banner for quick access

**State 2: Logged in, but no notification channel linked**
- All watchlist toggles are visually disabled (grayed out)
- Prominent banner/alert at the top of the catalog:
  - "Aby korzystac z listy obserwowanych, najpierw skonfiguruj powiadomienia."
  - "Bez aktywnego kanalu powiadomien nie bedziemy mogli informowac Cie o zmianach cen."
  - Includes a link/button: "Przejdz do ustawien" → navigates to `/ustawienia`

**State 3: Logged in + notification linked**
- All toggles are enabled, full watchlist functionality available

### Settings Page (`/ustawienia`) — accessed from user dropdown menu
- **Section 1: Profil** — display name, email (read-only info from Google)
- **Section 2: Powiadomienia** — notification channel management (scalable)
  - Config-driven: array of `NotificationChannelConfig` objects
  - Each channel: generic `NotificationChannelCard` wrapper + channel-specific setup component
  - Adding future channels = new config entry + new setup component
  - Telegram setup steps:
    1. Otwórz Telegram i wyszukaj bota **@tcg_pokemon_bot**
    2. Kliknij "Wygeneruj token" → `POST /users/me/telegram/link-token`
    3. Skopiuj token i wyślij do bota komendę: `/link <token>`
  - Once `telegramLinked: true` → success badge, token hidden, "Odłącz" button
  - Info alert: "Obecnie wspieramy tylko powiadomienia przez Telegram. Pracujemy nad dodaniem kolejnych opcji."

### Theme (Pikachu Dark)
- Dark mode default: charcoal (#1a1a2e) backgrounds
- Primary: amber (#FFC107), used for buttons, toggles, accents, ring/focus
- Cards: slightly lighter dark surface
- All shadcn CSS variables overridden in globals.css

### Responsive / Mobile-First Design
- **Product grid**: 1 column on mobile, 2 on tablet, 3-4 on desktop (Tailwind `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`)
- **Header**: logo + hamburger menu on mobile; full nav on desktop. User menu collapses into hamburger
- **Product cards**: stack image above text on mobile, keep compact layout
- **Set groups**: collapsible accordion sections — easier to navigate on small screens
- **MaxPrice input**: full-width on mobile, inline on desktop
- **Settings page**: single column layout that works naturally on all sizes
- **Telegram setup steps**: vertical stepper that reads well on narrow screens
- **Touch targets**: all interactive elements (toggles, buttons) min 44px tap target
- **Banners/alerts**: full-width, text wraps naturally, buttons stack vertically on mobile

## Frontend Types (reflecting API)

```typescript
// Product (from enriched GET /products)
interface Product {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  disabled?: boolean;
  currentBestPrice: number | null;
  currentBestShop: string | null;
  currentBestUrl: string | null;
}

// ProductSet (from GET /product-sets)
interface ProductSet {
  id: string;
  name: string;
  series: string;
  imageUrl: string;
  releaseDate?: string;
}

// WatchlistEntry (simplified GET /watchlist)
interface WatchlistEntry {
  id: string;
  productId: string;
  maxPrice: number;
  isActive: boolean;
  createdAt: string;
}

// UserProfile (from GET /users/me)
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  telegramLinked: boolean;
}
```

## Testing

### Stack
- **Vitest** + **React Testing Library** + **MSW** (Mock Service Worker)

### Key test scenarios
- **Unlogged user**: catalog visible, toggles disabled, login prompt shown
- **Logged user without Telegram**: watchlist toggles disabled, message to set up notifications
- **Logged user with Telegram**: full watchlist functionality enabled
- **Product grouping**: products grouped by set, sorted by releaseDate desc, orphans in "Inne"
- **MaxPrice validation**: rejects values > currentBestPrice with Polish error message
- **Auto-save**: debounced PATCH fires after 500ms of inactivity
- **Telegram linking flow**: generate token → display → copy → linked state → unlink

## Verification
1. **API tests**: `cd pokebot-api && npm test` — all tests pass
2. **Frontend dev**: `cd pokebot-client && npm run dev` — starts without errors on `localhost:5173`
3. **Frontend tests**: `cd pokebot-client && npm test` — all tests pass
4. Product catalog renders with grouped sets
5. Google OAuth flow: login → callback → token stored → user menu shown
6. Watchlist toggles: add/remove products, maxPrice auto-saves
7. maxPrice validation rejects values > currentBestPrice
8. Telegram setup: generate token → display → linked status → unlink
9. Unlogged view: catalog visible, all interactive features disabled with prompts
10. Responsive: works on mobile viewport widths
