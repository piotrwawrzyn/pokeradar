import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import './config/passport';

import { env } from './config/env';
import {
  authMiddleware,
  adminMiddleware,
  errorMiddleware,
  globalRateLimiter,
} from './shared/middleware';

import { getAppSettings } from './infrastructure/database/models';
import authRouter from './modules/auth/auth.router';
import productsRouter from './modules/products/products.router';
import watchlistRouter from './modules/watchlist/watchlist.router';
import usersRouter from './modules/users/users.router';
import productSetsRouter from './modules/product-sets/product-sets.router';
import adminRouter from './modules/admin/admin.router';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(passport.initialize());
app.use(globalRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/auth/signup-status', async (_req, res, next) => {
  try {
    const settings = await getAppSettings();
    res.json({
      signupsEnabled: settings.signupsEnabled,
      loginEnabled: settings.loginEnabled,
    });
  } catch (error) {
    next(error);
  }
});

app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/product-sets', productSetsRouter);
app.use('/watchlist', authMiddleware, watchlistRouter);
app.use('/users', authMiddleware, usersRouter);
app.use('/admin', authMiddleware, adminMiddleware, adminRouter);

app.use(errorMiddleware);

export default app;
