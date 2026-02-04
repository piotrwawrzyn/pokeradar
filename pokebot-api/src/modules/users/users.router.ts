import { Router } from 'express';
import { UsersController } from './users.controller';

const router = Router();
const controller = new UsersController();

router.get('/me', (req, res, next) => controller.getMe(req, res, next));
router.post('/me/telegram/link-token', (req, res, next) => controller.generateLinkToken(req, res, next));
router.delete('/me/telegram', (req, res, next) => controller.unlinkTelegram(req, res, next));

export default router;
