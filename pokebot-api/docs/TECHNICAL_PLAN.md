# Pokebot API — Express Backend Service Implementation Plan

## Context

This plan is for building a **new separate repository** (`pokebot-api`) — a stateless Express REST API. It shares the same MongoDB database as an existing scraper bot (`pokebot_2.0`). The scraper runs as a cron job, scrapes 25 Polish e-commerce shops for Pokemon product prices, and stores results in MongoDB. The API provides user-facing CRUD operations on top of that data.

**Notifications are sent by the scraper, NOT the API.** The API only manages users, their watchlists, and reads price data.

---

## Existing MongoDB Collections (owned by scraper, READ-ONLY for API)

The API connects to the same MongoDB database. These collections already exist and must not be modified.

### Collection: `watchlistproducts`

Mongoose model name: `'WatchlistProduct'` (Mongoose auto-pluralizes to `watchlistproducts`).

```typescript
// Exact schema from scraper: src/infrastructure/database/models/watchlist-product.model.ts
interface IWatchlistProductDoc extends Document {
  id: string;        // Kebab-case string, e.g. "pokemon-151-booster-box" — NOT MongoDB _id
  name: string;
  imageUrl: string;            // Product image URL (required)
  productSetId?: string;       // Optional reference to ProductSet.id
  search: {
    phrases: string[];
    exclude?: string[];
  };
  price: {
    max: number;
    min?: number;
  };
}

const WatchlistProductSchema = new Schema<IWatchlistProductDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  imageUrl: { type: String, required: true },
  productSetId: { type: String },
  search: {
    phrases: { type: [String], required: true },
    exclude: { type: [String], default: [] },
  },
  price: {
    max: { type: Number, required: true },
    min: { type: Number },
  },
});

// Registered as:
mongoose.model<IWatchlistProductDoc>('WatchlistProduct', WatchlistProductSchema);
```

**API usage:** The API reads this as a product catalog. It uses `id`, `name`, `imageUrl`, and `productSetId` fields. The `search` and `price` fields are used by the scraper and can be ignored by the API. The API's domain type is called `Product` (not `WatchlistProduct`) but the Mongoose model name MUST be `'WatchlistProduct'` to map to the existing collection.

### Collection: `productresults`

Mongoose model name: `'ProductResult'`.

```typescript
// Exact schema from scraper: src/infrastructure/database/models/product-result.model.ts
interface IProductResultDoc extends Document {
  productId: string;
  shopId: string;
  hourBucket: string;   // Format: "YYYY-MM-DDTHH" for hourly aggregation
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
  createdAt: Date;
}

const ProductResultSchema = new Schema<IProductResultDoc>(
  {
    productId: { type: String, required: true },
    shopId: { type: String, required: true },
    hourBucket: { type: String, required: true },
    productUrl: { type: String, default: '' },
    price: { type: Number, default: null },
    isAvailable: { type: Boolean, required: true },
    timestamp: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes (already exist, created by scraper):
ProductResultSchema.index({ productId: 1, shopId: 1, hourBucket: 1 }, { unique: true });
ProductResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 }); // 24h TTL
ProductResultSchema.index({ productId: 1, timestamp: -1 });

mongoose.model<IProductResultDoc>('ProductResult', ProductResultSchema);
```

**API usage:** Read-only. Used to show current prices per shop. Results auto-expire after 24 hours via TTL index. The API must handle the case where no recent results exist.

**Key aggregation pattern used by the scraper** (to reuse in the API for getting best prices):

```typescript
// Get best available offer for given products in the last hour
function getFreshnessCutoff(): Date {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(cutoff.getHours() - 1, 0, 0, 0);
  return cutoff;
}

// Aggregation: latest result per shop, then pick cheapest
const pipeline = [
  { $match: { productId: { $in: productIds }, isAvailable: true, price: { $ne: null }, timestamp: { $gte: cutoff } } },
  { $sort: { productId: 1, shopId: 1, timestamp: -1 } },
  { $group: { _id: { productId: '$productId', shopId: '$shopId' }, doc: { $first: '$$ROOT' } } },
  { $replaceRoot: { newRoot: '$doc' } },
  { $sort: { productId: 1, price: 1 } },
  { $group: { _id: '$productId', doc: { $first: '$$ROOT' } } },
  { $replaceRoot: { newRoot: '$doc' } },
];
```

### Collection: `productsets` (owned by API)

Mongoose model name: `'ProductSet'`.

```typescript
interface IProductSetDoc extends Document {
  id: string;        // Unique identifier, e.g. "sv-surging-sparks"
  name: string;      // Display name, e.g. "Scarlet & Violet - Surging Sparks"
  series: string;    // Series grouping, e.g. "Scarlet & Violet"
  imageUrl: string;  // Set logo/artwork image URL
  releaseDate?: Date; // Optional release date
}

const ProductSetSchema = new Schema<IProductSetDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  series: { type: String, required: true },
  imageUrl: { type: String, required: true },
  releaseDate: { type: Date },
});

mongoose.model<IProductSetDoc>('ProductSet', ProductSetSchema);
```

**API usage:** Used to group products by their TCG set. Products optionally reference a ProductSet via `productSetId`.

### Collection: `notificationstates`

Not used by the API at all. Owned entirely by the scraper.

---

## Existing Scraper Config Reference

```json
// package.json — key versions to match
{
  "mongoose": "^9.1.5",
  "typescript": "^5.9.3",
  "node": ">=18.0.0"
}
```

```json
// tsconfig.json — match these settings
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "sourceMap": true
  }
}
```

```typescript
// Database connection pattern from scraper: src/infrastructure/database/db-connect.ts
import mongoose from 'mongoose';

export async function connectDB(mongoUri: string): Promise<void> {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(mongoUri);
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}
```

---

## Tech Stack

- **Express 4.x** + **TypeScript** (ES2020 target, CommonJS modules)
- **Mongoose ^9.1.5** (must match scraper version exactly)
- **passport** + **passport-google-oauth20** (Google OAuth)
- **jsonwebtoken** (JWT auth, stateless — no sessions)
- **Zod** (request validation)
- **helmet**, **cors**, **express-rate-limit** (security)
- **dotenv** (environment config)

---

## Project Structure

```
pokebot-api/
  src/
    server.ts                           # Entry point — connect DB, start listening
    app.ts                              # Express app factory, middleware + route assembly
    config/
      env.ts                            # Zod-validated environment variables
      passport.ts                       # Google OAuth strategy registration
    infrastructure/
      database/
        db-connect.ts                   # MongoDB connection (same pattern as scraper)
        models/
          user.model.ts                 # NEW collection
          user-watch-entry.model.ts     # NEW collection
          product.model.ts              # Read-only mirror of scraper's watchlistproducts
          product-result.model.ts       # Read-only mirror of scraper's productresults
          product-set.model.ts          # ProductSet — groups products by TCG set
          index.ts                      # Barrel export
    shared/
      types/
        user.types.ts
        user-watch-entry.types.ts
        product.types.ts
        product-result.types.ts
        api-responses.types.ts
        index.ts
      middleware/
        auth.middleware.ts              # JWT verification, extends Express Request
        error.middleware.ts             # Global error handler + AppError classes
        validate.middleware.ts          # Generic Zod validation wrapper
        rate-limit.middleware.ts        # Global + auth-specific rate limiters
        index.ts
    modules/
      auth/
        auth.router.ts
        auth.controller.ts
        auth.service.ts
      products/
        products.router.ts
        products.controller.ts
        products.service.ts
      product-sets/
        product-sets.router.ts
        product-sets.controller.ts
        product-sets.service.ts
      watchlist/
        watchlist.router.ts
        watchlist.controller.ts
        watchlist.service.ts
        watchlist.validation.ts         # Zod schemas for watchlist endpoints
      users/
        users.router.ts
        users.controller.ts
        users.service.ts
  .env.example
  .gitignore
  package.json
  tsconfig.json
```

---

## Domain Types

### User (`src/shared/types/user.types.ts`)

```typescript
export interface User {
  id: string;                          // MongoDB _id as string
  googleId: string;
  email: string;
  displayName: string;
  telegramChatId: string | null;       // Set by scraper bot via /link command
  telegramLinkToken: string | null;    // UUID v4, single-use, cleared after linking
  createdAt: Date;
  updatedAt: Date;
}
```

### UserWatchEntry (`src/shared/types/user-watch-entry.types.ts`)

```typescript
export interface UserWatchEntry {
  id: string;              // MongoDB _id as string
  userId: string;
  productId: string;       // References WatchlistProduct.id (kebab-case string, NOT ObjectId)
  maxPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Product (`src/shared/types/product.types.ts`)

```typescript
// Maps to existing watchlistproducts collection
export interface Product {
  id: string;              // Kebab-case string, e.g. "pokemon-151-booster-box"
  name: string;
  imageUrl: string;        // Product image URL
  productSetId?: string;   // Optional reference to ProductSet.id
}

export interface ProductSet {
  id: string;              // e.g. "sv-surging-sparks"
  name: string;            // e.g. "Scarlet & Violet - Surging Sparks"
  series: string;          // e.g. "Scarlet & Violet"
  imageUrl: string;        // Set logo/artwork URL
  releaseDate?: Date;
}
```

### ProductResult (`src/shared/types/product-result.types.ts`)

```typescript
export interface ProductResult {
  productId: string;
  shopId: string;
  productUrl: string;
  price: number | null;
  isAvailable: boolean;
  timestamp: Date;
}
```

### API Response Types (`src/shared/types/api-responses.types.ts`)

```typescript
// GET /watchlist — enriched entry with live price data
export interface WatchlistEntryResponse {
  id: string;
  productId: string;
  productName: string;
  maxPrice: number;
  isActive: boolean;
  currentBestPrice: number | null;
  currentBestShop: string | null;
  currentBestUrl: string | null;
  createdAt: Date;
}

// GET /products/:id/prices — price per shop
export interface ProductPriceResponse {
  shopId: string;
  price: number | null;
  isAvailable: boolean;
  productUrl: string;
  timestamp: Date;
}

// GET /users/me
export interface UserProfileResponse {
  id: string;
  email: string;
  displayName: string;
  telegramLinked: boolean;         // Derived: telegramChatId !== null
}

// POST /users/me/telegram/link-token
export interface TelegramLinkTokenResponse {
  telegramLinkToken: string;       // UUID v4 to send to bot via /link command
}

// JWT payload (stored inside the token)
export interface AuthPayload {
  userId: string;
  email: string;
}
```

### Validation Schemas (`src/modules/watchlist/watchlist.validation.ts`)

```typescript
import { z } from 'zod';

// POST /watchlist
export const addWatchEntrySchema = z.object({
  body: z.object({
    productId: z.string().min(1),
    maxPrice: z.number().positive(),
  }),
});

// PATCH /watchlist/:id
export const updateWatchEntrySchema = z.object({
  body: z.object({
    maxPrice: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  }).refine(
    data => data.maxPrice !== undefined || data.isActive !== undefined,
    { message: 'At least one field (maxPrice or isActive) must be provided' }
  ),
});
```

---

## New MongoDB Models (owned by API)

### User Model (`src/infrastructure/database/models/user.model.ts`)

Collection: `users`

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDoc extends Document {
  googleId: string;
  email: string;
  displayName: string;
  telegramChatId: string | null;
  telegramLinkToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    telegramChatId: { type: String, default: null },
    telegramLinkToken: { type: String, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ googleId: 1 });
UserSchema.index({ telegramLinkToken: 1 }, { sparse: true }); // For bot /link lookup

export const UserModel = mongoose.model<IUserDoc>('User', UserSchema);
```

### UserWatchEntry Model (`src/infrastructure/database/models/user-watch-entry.model.ts`)

Collection: `userwatchentries`

```typescript
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserWatchEntryDoc extends Document {
  userId: Types.ObjectId;
  productId: string;       // String, NOT ObjectId — matches WatchlistProduct.id
  maxPrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserWatchEntrySchema = new Schema<IUserWatchEntryDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: String, required: true },
    maxPrice: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One watch entry per user per product
UserWatchEntrySchema.index({ userId: 1, productId: 1 }, { unique: true });
// For scraper fan-out: find all watchers of a product
UserWatchEntrySchema.index({ productId: 1, isActive: 1 });
// For user's watchlist page
UserWatchEntrySchema.index({ userId: 1, isActive: 1 });

export const UserWatchEntryModel = mongoose.model<IUserWatchEntryDoc>(
  'UserWatchEntry',
  UserWatchEntrySchema
);
```

### Read-Only Mirrors

**Product model** (`src/infrastructure/database/models/product.model.ts`):
- Must register as `mongoose.model('WatchlistProduct', schema)` to map to existing `watchlistproducts` collection
- Schema includes `imageUrl` (required) and `productSetId` (optional) in addition to scraper fields
- The API reads `id`, `name`, `imageUrl`, and `productSetId`

**ProductSet model** (`src/infrastructure/database/models/product-set.model.ts`):
- Owned by the API — collection `productsets`
- Groups products by TCG set (e.g. "Scarlet & Violet - Surging Sparks")
- Fields: `id`, `name`, `series`, `imageUrl`, `releaseDate`

**ProductResult model** (`src/infrastructure/database/models/product-result.model.ts`):
- Must register as `mongoose.model('ProductResult', schema)`
- Schema and indexes must be identical to the scraper's (see above)
- The API only reads, never writes

---

## API Endpoints

### Auth (no JWT required, separate rate limit)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Redirect to Google consent screen via Passport |
| GET | `/auth/google/callback` | Handle OAuth callback, find-or-create user, generate JWT, redirect to `${CORS_ORIGIN}/auth/callback?token=<jwt>` |
| GET | `/auth/me` | **(JWT required)** Return current user profile |

**Auth flow detail:**
1. Frontend redirects browser to `GET /auth/google`
2. Passport redirects to Google consent screen (scope: `profile`, `email`)
3. Google redirects back to `GET /auth/google/callback`
4. Callback handler: find user by `googleId` or create new one, generate JWT with `{ userId, email }`, redirect to `${CORS_ORIGIN}/auth/callback?token=xxx`
5. Frontend SPA captures token from URL, stores it, uses `Authorization: Bearer <token>` for subsequent requests

**Passport config:** No `serializeUser`/`deserializeUser` needed — stateless JWT, no sessions. Set `session: false` in `passport.authenticate()`.

### Products (public, no auth required, read-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products` | List all products from catalog (id + name only) |
| GET | `/products/:id` | Single product by its string id |
| GET | `/products/:id/prices` | Latest price per shop — aggregation on ProductResult (latest result per shop, sorted by price) |

**`GET /products/:id/prices` aggregation:**
```typescript
const cutoff = new Date();
cutoff.setHours(cutoff.getHours() - 1, 0, 0, 0);

const results = await ProductResultModel.aggregate([
  { $match: { productId: id, timestamp: { $gte: cutoff } } },
  { $sort: { shopId: 1, timestamp: -1 } },
  { $group: {
    _id: '$shopId',
    shopId: { $first: '$shopId' },
    price: { $first: '$price' },
    isAvailable: { $first: '$isAvailable' },
    productUrl: { $first: '$productUrl' },
    timestamp: { $first: '$timestamp' },
  }},
  { $sort: { price: 1 } },
]);
```

### Product Sets (public, no auth required, read-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/product-sets` | List all product sets |
| GET | `/product-sets/:id` | Single product set by its string id |

### Watchlist (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/watchlist` | User's watch entries enriched with current best price |
| POST | `/watchlist` | Add product `{ productId, maxPrice }` — validate product exists in catalog |
| PATCH | `/watchlist/:id` | Update `{ maxPrice?, isActive? }` |
| DELETE | `/watchlist/:id` | Remove from watchlist |

**All queries filter by `req.user.userId`** — users can only see/modify their own entries.

**`GET /watchlist` implementation:**
1. Load user's `UserWatchEntry` docs
2. Batch-fetch product names: `WatchlistProductModel.find({ id: { $in: productIds } })`
3. Batch-fetch best prices using the aggregation pipeline from the scraper (see above)
4. Join and return `WatchlistEntryResponse[]`

**`POST /watchlist` implementation:**
1. Validate `productId` exists in catalog: `WatchlistProductModel.findOne({ id: productId })`
2. Create `UserWatchEntry` — unique index on `(userId, productId)` prevents duplicates
3. Catch Mongoose duplicate key error (E11000) → return 409 Conflict

**`PATCH /watchlist/:id` and `DELETE /watchlist/:id`:**
Always include `userId` in the query filter for authorization:
```typescript
UserWatchEntryModel.findOneAndUpdate(
  { _id: entryId, userId: req.user.userId },
  { $set: updates },
  { new: true }
);
```

### Users (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me` | Get profile (includes `telegramLinked: boolean`) |
| POST | `/users/me/telegram/link-token` | Generate UUID v4 link token, store on User doc, return it |
| DELETE | `/users/me/telegram` | Unlink Telegram — clear `telegramChatId` and `telegramLinkToken` |

### Telegram Linking Flow

1. User clicks "Link Telegram" in web UI → frontend calls `POST /users/me/telegram/link-token`
2. API generates `crypto.randomUUID()`, stores it as `telegramLinkToken` on the User doc, returns the token
3. UI displays: _"Open our Telegram bot and send: `/link <token>`"_
4. User opens Telegram, sends `/link <token>` to the bot
5. **Scraper bot** (separate process) receives the message → looks up `UserModel.findOne({ telegramLinkToken: token })` → sets `telegramChatId` from the Telegram message's `chat.id`, clears `telegramLinkToken` to null
6. Done — `GET /users/me` now returns `telegramLinked: true`

**Unlinking:** `DELETE /users/me/telegram` sets both `telegramChatId` and `telegramLinkToken` to null. User can re-link by calling `POST /users/me/telegram/link-token` again to get a fresh token.

The scraper bot's `/link` handler is NOT part of this API — it will be added to the scraper repo separately.

---

## Middleware

### Auth Middleware (`src/shared/middleware/auth.middleware.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AuthPayload } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

### Error Middleware (`src/shared/middleware/error.middleware.ts`)

```typescript
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') { super(404, message); }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') { super(409, message); }
}

// Global error handler — must be last middleware
export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  // Mongoose duplicate key error → 409
  if ((err as any).code === 11000) {
    res.status(409).json({ error: 'Resource already exists' });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

### Validation Middleware (`src/shared/middleware/validate.middleware.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({ body: req.body, query: req.query, params: req.params });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
        return;
      }
      next(error);
    }
  };
}
```

### Rate Limiting (`src/shared/middleware/rate-limit.middleware.ts`)

Two rate limiters:
- **Global:** 100 requests per 15 minutes per IP
- **Auth:** 10 requests per 15 minutes per IP (on `/auth` routes only)

### Middleware Stack in `app.ts` (applied in order)

1. `helmet()` — security headers
2. `cors({ origin: env.CORS_ORIGIN, credentials: true })`
3. `express.json()`
4. `passport.initialize()` — no sessions
5. `globalRateLimiter`
6. Routes:
   - `/health` — no auth, returns `{ status: 'ok' }`
   - `/auth` — `authRateLimiter`, no JWT required (except `/auth/me`)
   - `/products` — public, no auth
   - `/product-sets` — public, no auth
   - `/watchlist` — `authMiddleware`
   - `/users` — `authMiddleware`
7. `errorMiddleware` — must be last

---

## Environment Variables

```bash
# .env.example
PORT=3000
NODE_ENV=development

# MongoDB (SAME database as scraper)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokebot

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT
JWT_SECRET=...                      # Min 32 characters
JWT_EXPIRES_IN=7d

# CORS (frontend URL)
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000         # 15 minutes
RATE_LIMIT_MAX=100
```

Validate all env vars at startup with Zod in `src/config/env.ts`. Fail fast with clear error messages if any are missing.

---

## App Assembly

### `src/server.ts`

```typescript
import { env } from './config/env';  // Validates env vars immediately on import
import { connectDB } from './infrastructure/database/db-connect';
import app from './app';

async function bootstrap() {
  await connectDB(env.MONGODB_URI);
  app.listen(env.PORT, () => {
    console.log(`[API] Server running on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

### `src/app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import './config/passport';  // Side-effect: registers Google strategy

import { env } from './config/env';
import { authMiddleware } from './shared/middleware/auth.middleware';
import { errorMiddleware } from './shared/middleware/error.middleware';
import { globalRateLimiter, authRateLimiter } from './shared/middleware/rate-limit.middleware';

import authRouter from './modules/auth/auth.router';
import productsRouter from './modules/products/products.router';
import productSetsRouter from './modules/product-sets/product-sets.router';
import watchlistRouter from './modules/watchlist/watchlist.router';
import usersRouter from './modules/users/users.router';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(passport.initialize());
app.use(globalRateLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRateLimiter, authRouter);
app.use('/products', productsRouter);              // Public — no auth
app.use('/product-sets', productSetsRouter);        // Public — no auth
app.use('/watchlist', authMiddleware, watchlistRouter);
app.use('/users', authMiddleware, usersRouter);

app.use(errorMiddleware);

export default app;
```

---

## package.json

```json
{
  "name": "pokebot-api",
  "version": "1.0.0",
  "main": "dist/server.js",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn src/server.ts"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^9.1.5",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.9",
    "@types/node": "^25.0.9",
    "@types/passport-google-oauth20": "^2.0.16",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.9.3"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Implementation Order

| Step | Task | Verification |
|------|------|-------------|
| 1 | Project scaffolding: `package.json`, `tsconfig.json`, `.env.example`, `.gitignore` | `npm install && npx tsc --noEmit` compiles with no errors |
| 2 | `src/config/env.ts` — Zod env validation | Server crashes with clear error on missing vars |
| 3 | `src/infrastructure/database/db-connect.ts` | Connects to MongoDB, logs success |
| 4 | All 4 Mongoose models (User, UserWatchEntry, Product mirror, ProductResult mirror) | Import in REPL, verify collection names match |
| 5 | Shared types (`src/shared/types/`) | Compile check — `npx tsc --noEmit` |
| 6 | Shared middleware (error, validate, rate-limit, auth) | Compile check |
| 7 | Auth module (passport config + routes + controller + service) | Google OAuth flow in browser → JWT returned → `/auth/me` returns user |
| 8 | Products module (read-only routes) | `curl -H "Authorization: Bearer <jwt>" localhost:3000/products` returns catalog |
| 9 | Watchlist module (CRUD routes) | POST/GET/PATCH/DELETE work, unique constraint returns 409, auth enforced |
| 10 | Users module (profile + Telegram link/unlink) | `POST /users/me/telegram/link-token` returns token; `DELETE /users/me/telegram` clears link |
| 11 | App assembly (`app.ts` + `server.ts`) | `npm run dev` starts server, all endpoints work end-to-end |

---

## Key Design Decisions

- **`productId` is a String, not ObjectId** — existing WatchlistProduct uses custom kebab-case string IDs. No `.populate()` across models; use manual joins via `{ id: { $in: [...] } }`.
- **No sessions** — stateless JWT auth. No passport `serializeUser`/`deserializeUser`. All state is in the token.
- **OAuth callback redirects to frontend** — `GET /auth/google/callback` generates JWT then redirects to `${CORS_ORIGIN}/auth/callback?token=xxx`. Frontend SPA captures it from the URL.
- **Same Mongoose version** as scraper (`^9.1.5`) to avoid schema compatibility issues when both processes share the same DB.
- **Read-only model schemas must be identical to scraper** to prevent MongoDB index conflicts. Declaring the same indexes in the API is safe (idempotent), but defining different ones would cause errors.
- **Telegram linking is split** between API (token generation) and scraper bot (`/link` command handler). The API never touches the Telegram Bot SDK.
- **Link token has no expiry** — UUID v4 has 122 bits of entropy, is single-use (cleared after linking), and cannot be brute-forced.

---

## Testing

### Stack

- **Jest** as test runner
- **supertest** for HTTP endpoint testing
- **mongodb-memory-server** for an in-memory MongoDB instance (no external DB needed for tests)

### Additional dev dependencies

```json
{
  "jest": "^29.7.0",
  "@types/jest": "^29.5.14",
  "ts-jest": "^29.3.0",
  "supertest": "^7.1.0",
  "@types/supertest": "^6.0.2",
  "mongodb-memory-server": "^10.4.0"
}
```

### Scripts

```json
{
  "test": "jest",
  "test:watch": "jest --watch"
}
```

### Test Structure

```
tests/
  setup.ts                          # Global setup: start MongoMemoryServer, connect Mongoose
  teardown.ts                       # Global teardown: stop MongoMemoryServer
  helpers/
    auth.helper.ts                  # Generate valid JWT for tests, create test users
    db.helper.ts                    # Seed/clear collections between tests
  modules/
    auth/
      auth.test.ts                  # OAuth callback mocking, JWT generation, /auth/me
    products/
      products.test.ts              # GET /products, GET /products/:id, GET /products/:id/prices
    watchlist/
      watchlist.test.ts             # Full CRUD: add, list (with price join), update, delete, duplicate handling
    users/
      users.test.ts                 # GET /users/me, POST link-token, DELETE unlink
  middleware/
    auth.middleware.test.ts         # Missing token, invalid token, expired token
    validate.middleware.test.ts     # Valid/invalid payloads against Zod schemas
```

### Test Helpers

**`tests/helpers/auth.helper.ts`:**
```typescript
import jwt from 'jsonwebtoken';
import { UserModel } from '../../src/infrastructure/database/models';

// Create a test user and return their JWT
export async function createTestUser(overrides = {}) {
  const user = await UserModel.create({
    googleId: 'test-google-id-' + Date.now(),
    email: `test-${Date.now()}@example.com`,
    displayName: 'Test User',
    ...overrides,
  });
  const token = jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-chars!',
    { expiresIn: '1h' }
  );
  return { user, token };
}
```

**`tests/helpers/db.helper.ts`:**
```typescript
import { UserModel, UserWatchEntryModel } from '../../src/infrastructure/database/models';
// Also import WatchlistProductModel and ProductResultModel for seeding

export async function clearDatabase() {
  await Promise.all([
    UserModel.deleteMany({}),
    UserWatchEntryModel.deleteMany({}),
    // Don't clear WatchlistProduct/ProductResult in most tests — seed them once
  ]);
}

export async function seedProducts() {
  // Insert a few test products into the watchlistproducts collection
  // These mirror what the scraper would have created
}

export async function seedProductResults(productId: string) {
  // Insert test price results for a product across a few shops
}
```

### Test Setup (`tests/setup.ts`)

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
```

### Jest Config (`jest.config.ts`)

```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterSetup: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/*.test.ts'],
};
```

### Key Test Scenarios

**Products:**
- `GET /products` returns all seeded products with `id`, `name`, `imageUrl`, and `productSetId`
- `GET /products/:id` returns 404 for nonexistent product
- `GET /products/:id/prices` returns empty array when no recent results
- `GET /products/:id/prices` returns prices sorted by price ascending
- All product endpoints are public (no auth required)
- `GET /product-sets` returns all seeded sets
- `GET /product-sets/:id` returns 404 for nonexistent set

**Watchlist:**
- `POST /watchlist` creates entry, returns 201
- `POST /watchlist` with nonexistent productId returns 404
- `POST /watchlist` duplicate returns 409
- `GET /watchlist` returns entries with joined product names and current prices
- `GET /watchlist` returns empty `currentBestPrice` when no fresh results
- `PATCH /watchlist/:id` updates maxPrice
- `PATCH /watchlist/:id` of another user's entry returns 404 (authorization)
- `DELETE /watchlist/:id` removes entry, returns 204
- `DELETE /watchlist/:id` of another user's entry returns 404

**Users:**
- `GET /users/me` returns profile with `telegramLinked: false` initially
- `POST /users/me/telegram/link-token` returns UUID, subsequent call returns new UUID (overwrites old)
- `DELETE /users/me/telegram` clears both `telegramChatId` and `telegramLinkToken`
- After simulating bot link (manually setting `telegramChatId`), `GET /users/me` returns `telegramLinked: true`

**Auth middleware:**
- Request without `Authorization` header → 401
- Request with malformed token → 401
- Request with expired token → 401
- Request with valid token → passes through, `req.user` populated

### Implementation Order for Tests

Add tests after step 11 (app assembly) as step 12:

| Step | Task | Verification |
|------|------|-------------|
| 12 | Test setup + helpers + all test suites | `npm test` — all green |
