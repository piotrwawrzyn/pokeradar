import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { clerkMiddleware } from '@clerk/express';

import { env } from './config/env';
import {
  authMiddleware,
  adminMiddleware,
  errorMiddleware,
  globalRateLimiter,
} from './shared/middleware';

import authRouter from './modules/auth/auth.router';
import productsRouter from './modules/products/products.router';
import watchlistRouter from './modules/watchlist/watchlist.router';
import usersRouter from './modules/users/users.router';
import productSetsRouter from './modules/product-sets/product-sets.router';
import adminRouter from './modules/admin/admin.router';

const app = express();

// Trust Railway proxy for rate limiting and client IP detection
app.set('trust proxy', 1);

app.use(helmet());

// CORS configuration with allowed origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (env.ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(clerkMiddleware());
app.use(globalRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/product-sets', productSetsRouter);
app.use('/watchlist', authMiddleware, watchlistRouter);
app.use('/users', authMiddleware, usersRouter);
app.use('/admin', authMiddleware, adminMiddleware, adminRouter);

app.use(errorMiddleware);

export default app;
