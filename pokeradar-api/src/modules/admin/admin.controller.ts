import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';

const adminService = new AdminService();

export class AdminController {
  async getMe(
    _req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    res.json({ isAdmin: true });
  }

  async getSettings(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const settings = await adminService.getSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const settings = await adminService.updateSettings(req.body);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }
}
