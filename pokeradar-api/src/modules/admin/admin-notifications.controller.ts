import { Request, Response, NextFunction } from 'express';
import { AdminNotificationsService } from './admin-notifications.service';

const notificationsService = new AdminNotificationsService();

export class AdminNotificationsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const status = req.query.status as string | undefined;
      const userId = req.query.userId as string | undefined;

      const result = await notificationsService.listNotifications({
        page,
        limit,
        status: status || undefined,
        userId: userId || undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
