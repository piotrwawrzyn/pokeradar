import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../shared/middleware';

const router = Router();
const controller = new AuthController();

router.get('/me', authMiddleware, (req: Request, res: Response, next: NextFunction) =>
  controller.getMe(req, res, next),
);

export default router;
