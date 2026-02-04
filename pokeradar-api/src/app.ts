import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import './config/passport';

import { env } from './config/env';
import {
  authMiddleware,
  errorMiddleware,
  globalRateLimiter,
  authRateLimiter,
} from './shared/middleware';

import authRouter from './modules/auth/auth.router';
import productsRouter from './modules/products/products.router';
import watchlistRouter from './modules/watchlist/watchlist.router';
import usersRouter from './modules/users/users.router';
import productSetsRouter from './modules/product-sets/product-sets.router';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(passport.initialize());
app.use(globalRateLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRateLimiter, authRouter);
app.use('/products', productsRouter);
app.use('/product-sets', productSetsRouter);
app.use('/watchlist', authMiddleware, watchlistRouter);
app.use('/users', authMiddleware, usersRouter);

app.use(errorMiddleware);

export default app;
