import { Router } from 'express';
import { AdminController } from './admin.controller';

const router = Router();
const controller = new AdminController();

router.get('/settings', (req, res, next) =>
  controller.getSettings(req, res, next)
);
router.patch('/settings', (req, res, next) =>
  controller.updateSettings(req, res, next)
);

export default router;
