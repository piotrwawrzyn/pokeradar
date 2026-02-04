import { Router } from 'express';
import passport from 'passport';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../shared/middleware';

const router = Router();
const controller = new AuthController();

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/auth/failure',
  }),
  (req, res) => controller.googleCallback(req, res)
);

router.get('/me', authMiddleware, (req, res, next) =>
  controller.getMe(req, res, next)
);

router.get('/failure', (_req, res) => {
  res.status(401).json({ error: 'Authentication failed' });
});

export default router;
