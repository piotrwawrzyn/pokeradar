import { Router } from 'express';
import { UsersController } from './users.controller';

const router = Router();
const controller = new UsersController();

router.get('/me', (req, res, next) => controller.getMe(req, res, next));
router.post('/me/telegram/link-token', (req, res, next) =>
  controller.generateTelegramLinkToken(req, res, next),
);
router.delete('/me/telegram', (req, res, next) => controller.unlinkTelegram(req, res, next));
router.post('/me/discord/link-token', (req, res, next) =>
  controller.generateDiscordLinkToken(req, res, next),
);
router.delete('/me/discord', (req, res, next) => controller.unlinkDiscord(req, res, next));

export default router;
