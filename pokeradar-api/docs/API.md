# Pokeradar API — Endpoint Reference

Base URL: `http://localhost:3000` (development)

## Authentication

Protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are obtained via the Google OAuth flow (see Auth section below). The JWT payload contains:

```json
{
  "userId": "6651abc123def456ghi789jk",
  "email": "user@example.com"
}
```

Token expiration is configurable (default: `7d`).

## Rate Limiting

- **Global:** 100 requests per 15 minutes per IP (all endpoints)
- **Auth:** 10 requests per 15 minutes per IP (`/auth/*` endpoints only)

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

Validation errors (400) include details:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "String must contain at least 1 character(s)",
      "path": ["body", "productId"]
    }
  ]
}
```

Common status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (success, empty body) |
| 400 | Validation error |
| 401 | Missing/invalid/expired token |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Health Check

### `GET /health`

**Auth:** None

**Response** `200`:

```json
{
  "status": "ok"
}
```

---

## Auth

### `GET /auth/google`

**Auth:** None

Redirects the browser to the Google OAuth consent screen. The frontend should navigate the user to this URL (full page redirect, not AJAX).

**Flow:**
1. Browser navigates to `GET /auth/google`
2. Server redirects to Google consent screen (scope: `profile`, `email`)
3. User grants consent
4. Google redirects to `GET /auth/google/callback`
5. Server generates JWT and redirects to `${CORS_ORIGIN}/auth/callback?token=<jwt>`
6. Frontend SPA captures the token from the URL query parameter

---

### `GET /auth/google/callback`

**Auth:** None

Handles the OAuth callback from Google. Not called directly by the frontend.

**On success:** Redirects to `${CORS_ORIGIN}/auth/callback?token=<jwt>`

**On failure:** Redirects to `GET /auth/failure`

---

### `GET /auth/failure`

**Auth:** None

**Response** `401`:

```json
{
  "error": "Authentication failed"
}
```

---

### `GET /auth/me`

**Auth:** Required (JWT)

Returns the authenticated user's profile. This is the same data as `GET /users/me`.

**Response** `200`:

```json
{
  "id": "6651abc123def456ghi789jk",
  "email": "user@example.com",
  "displayName": "John Doe",
  "telegramLinked": false
}
```

**Response** `404`:

```json
{
  "error": "User not found"
}
```

---

## Products (Public)

No authentication required. These endpoints are public so the product catalog can be displayed before the user logs in.

### `GET /products`

Returns all products in the catalog, enriched with the current best price from all shops.

**Response** `200`:

```json
[
  {
    "id": "pokemon-151-booster-box",
    "name": "Pokemon 151 Booster Box",
    "imageUrl": "https://example.com/images/pokemon-151.jpg",
    "productSetId": "sv-pokemon-151",
    "currentBestPrice": 159.99,
    "currentBestShop": "allegro",
    "currentBestUrl": "https://allegro.pl/product/12345"
  },
  {
    "id": "surging-sparks-etb",
    "name": "Surging Sparks Elite Trainer Box",
    "imageUrl": "https://example.com/images/surging-sparks-etb.jpg",
    "productSetId": "sv-surging-sparks",
    "currentBestPrice": null,
    "currentBestShop": null,
    "currentBestUrl": null
  },
  {
    "id": "charizard-upc",
    "name": "Charizard Ultra Premium Collection",
    "imageUrl": "https://example.com/images/charizard-upc.jpg",
    "disabled": true,
    "currentBestPrice": null,
    "currentBestShop": null,
    "currentBestUrl": null
  }
]
```

**Notes:**
- `productSetId` is optional — may be `undefined`/absent if the product is not associated with a set
- `disabled` is optional — when `true`, notifications are globally disabled for this product (users cannot override this)
- `imageUrl` is always present
- `currentBestPrice` is the lowest available price across all shops from the last hour, or `null` if no recent results
- `currentBestShop` and `currentBestUrl` correspond to the shop offering the best price

---

### `GET /products/:id`

Returns a single product by its string ID.

**URL params:**
- `id` — Product ID (kebab-case string, e.g. `pokemon-151-booster-box`)

**Response** `200`:

```json
{
  "id": "pokemon-151-booster-box",
  "name": "Pokemon 151 Booster Box",
  "imageUrl": "https://example.com/images/pokemon-151.jpg",
  "productSetId": "sv-pokemon-151",
  "disabled": true
}
```

**Response** `404`:

```json
{
  "error": "Product not found"
}
```

---

### `GET /products/:id/prices`

Returns the latest price from each shop for the given product. Only includes results from the last hour. Results are sorted by price ascending (cheapest first).

**URL params:**
- `id` — Product ID (kebab-case string)

**Response** `200`:

```json
[
  {
    "shopId": "allegro",
    "price": 159.99,
    "isAvailable": true,
    "productUrl": "https://allegro.pl/product/12345",
    "timestamp": "2026-01-31T12:00:00.000Z"
  },
  {
    "shopId": "empik",
    "price": 179.99,
    "isAvailable": true,
    "productUrl": "https://empik.com/product/67890",
    "timestamp": "2026-01-31T12:00:00.000Z"
  },
  {
    "shopId": "cardshop",
    "price": null,
    "isAvailable": false,
    "productUrl": "https://cardshop.pl/product/111",
    "timestamp": "2026-01-31T12:00:00.000Z"
  }
]
```

**Response** `200` (no recent results):

```json
[]
```

**Response** `404`:

```json
{
  "error": "Product not found"
}
```

**Notes:**
- `price` can be `null` when the product is listed but price is unavailable
- `isAvailable` indicates whether the shop currently has the product in stock
- Only the latest result per shop is returned (deduplication by `shopId`)
- Data older than 1 hour is excluded
- Price data auto-expires from the database after 24 hours

---

## Product Sets (Public)

No authentication required.

### `GET /product-sets`

Returns all product sets.

**Response** `200`:

```json
[
  {
    "id": "sv-surging-sparks",
    "name": "Scarlet & Violet - Surging Sparks",
    "series": "Scarlet & Violet",
    "imageUrl": "https://example.com/images/sv-surging-sparks.jpg",
    "releaseDate": "2024-11-08T00:00:00.000Z"
  },
  {
    "id": "sv-pokemon-151",
    "name": "Scarlet & Violet - 151",
    "series": "Scarlet & Violet",
    "imageUrl": "https://example.com/images/sv-151.jpg",
    "releaseDate": "2023-09-22T00:00:00.000Z"
  }
]
```

**Notes:**
- `releaseDate` is optional — may be `undefined`/absent
- `series` groups sets together (e.g. all "Scarlet & Violet" sets share the same series value)

---

### `GET /product-sets/:id`

Returns a single product set by its string ID.

**URL params:**
- `id` — Product set ID (e.g. `sv-surging-sparks`)

**Response** `200`:

```json
{
  "id": "sv-surging-sparks",
  "name": "Scarlet & Violet - Surging Sparks",
  "series": "Scarlet & Violet",
  "imageUrl": "https://example.com/images/sv-surging-sparks.jpg",
  "releaseDate": "2024-11-08T00:00:00.000Z"
}
```

**Response** `404`:

```json
{
  "error": "Product set not found"
}
```

---

## Watchlist (Authenticated)

All watchlist endpoints require a valid JWT. Each user can only see and modify their own watchlist entries.

### `GET /watchlist`

Returns the authenticated user's watchlist entries. Product names and prices are available via `GET /products`.

**Response** `200`:

```json
[
  {
    "id": "6651abc123def456ghi789jk",
    "productId": "pokemon-151-booster-box",
    "maxPrice": 180,
    "isActive": true,
    "createdAt": "2026-01-20T10:30:00.000Z"
  },
  {
    "id": "6651abc123def456ghi789jl",
    "productId": "charizard-upc",
    "maxPrice": 400,
    "isActive": false,
    "createdAt": "2026-01-22T14:00:00.000Z"
  }
]
```

**Notes:**
- `id` is the watchlist entry's ID (MongoDB ObjectId as string), not the product ID
- Product names and current best prices are now available on `GET /products` — the frontend joins client-side

---

### `POST /watchlist`

Adds a product to the user's watchlist.

**Request body:**

```json
{
  "productId": "pokemon-151-booster-box",
  "maxPrice": 180
}
```

**Validation rules:**
- `productId` — required, non-empty string, must exist in the product catalog
- `maxPrice` — required, positive number

**Response** `201`:

```json
{
  "id": "6651abc123def456ghi789jk",
  "productId": "pokemon-151-booster-box",
  "maxPrice": 180,
  "isActive": true,
  "createdAt": "2026-01-31T12:00:00.000Z"
}
```

**Response** `404`:

```json
{
  "error": "Product not found in catalog"
}
```

**Response** `409`:

```json
{
  "error": "Resource already exists"
}
```

**Notes:**
- Each user can only have one watchlist entry per product (unique constraint on `userId` + `productId`)
- New entries default to `isActive: true`

---

### `PATCH /watchlist/:id`

Updates a watchlist entry's max price or active status.

**URL params:**
- `id` — Watchlist entry ID (MongoDB ObjectId string)

**Request body** (at least one field required):

```json
{
  "maxPrice": 200,
  "isActive": false
}
```

**Validation rules:**
- `maxPrice` — optional, positive number
- `isActive` — optional, boolean
- At least one of `maxPrice` or `isActive` must be provided

**Response** `200`:

```json
{
  "id": "6651abc123def456ghi789jk",
  "productId": "pokemon-151-booster-box",
  "maxPrice": 200,
  "isActive": false,
  "createdAt": "2026-01-31T12:00:00.000Z"
}
```

**Response** `400`:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "message": "At least one field (maxPrice or isActive) must be provided",
      "path": []
    }
  ]
}
```

**Response** `404`:

```json
{
  "error": "Watch entry not found"
}
```

**Notes:**
- Users can only update their own entries — attempting to update another user's entry returns 404
- Both fields can be updated in a single request

---

### `DELETE /watchlist/:id`

Removes a product from the user's watchlist.

**URL params:**
- `id` — Watchlist entry ID (MongoDB ObjectId string)

**Response** `204`: *(empty body)*

**Response** `404`:

```json
{
  "error": "Watch entry not found"
}
```

**Notes:**
- Users can only delete their own entries — attempting to delete another user's entry returns 404

---

## Users (Authenticated)

### `GET /users/me`

Returns the authenticated user's profile.

**Response** `200`:

```json
{
  "id": "6651abc123def456ghi789jk",
  "email": "user@example.com",
  "displayName": "John Doe",
  "telegramLinked": false
}
```

**Notes:**
- `telegramLinked` is `true` when the user has linked their Telegram account via the bot

---

### `POST /users/me/telegram/link-token`

Generates a one-time token for linking a Telegram account. The user sends this token to the Telegram bot via `/link <token>` to complete the linking.

**Request body:** None

**Response** `200`:

```json
{
  "telegramLinkToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Notes:**
- Token is a UUID v4 string
- Calling this endpoint again overwrites any previous unlinked token
- After the bot processes the `/link` command, the token is cleared and `telegramLinked` becomes `true`

---

### `DELETE /users/me/telegram`

Unlinks the user's Telegram account.

**Response** `204`: *(empty body)*

**Notes:**
- Clears both the Telegram chat ID and any pending link token
- After unlinking, the user can re-link by generating a new token

---

## TypeScript Types Reference

These are the exact TypeScript interfaces used in the API responses. Use these to type your frontend API client.

```typescript
// GET /products — array items (enriched with best price)
interface ProductWithPrice {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  disabled?: boolean;
  currentBestPrice: number | null;
  currentBestShop: string | null;
  currentBestUrl: string | null;
}

// GET /products/:id
interface Product {
  id: string;
  name: string;
  imageUrl: string;
  productSetId?: string;
  disabled?: boolean;
}

// GET /product-sets, GET /product-sets/:id
interface ProductSet {
  id: string;
  name: string;
  series: string;
  imageUrl: string;
  releaseDate?: Date;       // ISO 8601 string in JSON
}

// GET /products/:id/prices — array items
interface ProductPriceResponse {
  shopId: string;
  price: number | null;
  isAvailable: boolean;
  productUrl: string;
  timestamp: Date;           // ISO 8601 string in JSON
}

// GET /watchlist — array items
interface WatchlistEntryResponse {
  id: string;
  productId: string;
  maxPrice: number;
  isActive: boolean;
  createdAt: Date;           // ISO 8601 string in JSON
}

// POST /watchlist — response
// PATCH /watchlist/:id — response
interface WatchlistEntryMutationResponse {
  id: string;
  productId: string;
  maxPrice: number;
  isActive: boolean;
  createdAt: Date;           // ISO 8601 string in JSON
}

// GET /auth/me, GET /users/me
interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  telegramLinked: boolean;
}

// POST /users/me/telegram/link-token
interface TelegramLinkTokenResponse {
  telegramLinkToken: string;
}

// POST /watchlist — request body
interface AddWatchEntryRequest {
  productId: string;         // min 1 character
  maxPrice: number;          // must be positive
}

// PATCH /watchlist/:id — request body (at least one field required)
interface UpdateWatchEntryRequest {
  maxPrice?: number;         // must be positive if provided
  isActive?: boolean;
}
```

---

## Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/auth/google` | No | Start Google OAuth flow (browser redirect) |
| GET | `/auth/google/callback` | No | OAuth callback (not called directly) |
| GET | `/auth/failure` | No | OAuth failure page |
| GET | `/auth/me` | JWT | Get authenticated user profile |
| GET | `/products` | No | List all products |
| GET | `/products/:id` | No | Get single product |
| GET | `/products/:id/prices` | No | Get latest prices per shop |
| GET | `/product-sets` | No | List all product sets |
| GET | `/product-sets/:id` | No | Get single product set |
| GET | `/watchlist` | JWT | Get user's watchlist with live prices |
| POST | `/watchlist` | JWT | Add product to watchlist |
| PATCH | `/watchlist/:id` | JWT | Update watchlist entry |
| DELETE | `/watchlist/:id` | JWT | Remove from watchlist |
| GET | `/users/me` | JWT | Get user profile |
| POST | `/users/me/telegram/link-token` | JWT | Generate Telegram link token |
| DELETE | `/users/me/telegram` | JWT | Unlink Telegram account |
