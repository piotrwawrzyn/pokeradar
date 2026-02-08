import { Router } from 'express';
import passport from 'passport';
import { AuthController } from './auth.controller';
import { authMiddleware, authRateLimiter } from '../../shared/middleware';
import { SignupsDisabledError, LoginDisabledError } from '../../config/passport';
import { env } from '../../config/env';

const router = Router();
const controller = new AuthController();

router.get(
  '/google',
  authRateLimiter,
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get('/google/callback', authRateLimiter, (req, res, next) => {
  passport.authenticate('google', { session: false }, (err: Error | null, user: Express.User | false) => {
    if (err instanceof SignupsDisabledError) {
      return res.redirect(`${env.CORS_ORIGIN}/auth/callback?error=signups_disabled`);
    }
    if (err instanceof LoginDisabledError) {
      return res.redirect(`${env.CORS_ORIGIN}/auth/callback?error=login_disabled`);
    }
    if (err || !user) {
      return res.redirect(`${env.CORS_ORIGIN}/auth/callback?error=auth_failed`);
    }
    req.user = user;
    controller.googleCallback(req, res);
  })(req, res, next);
});

router.get('/me', authMiddleware, (req, res, next) =>
  controller.getMe(req, res, next)
);

router.get('/failure', (_req, res) => {
  res.status(401).json({ error: 'Authentication failed' });
});

export default router;
