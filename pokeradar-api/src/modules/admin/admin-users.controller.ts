import { Request, Response, NextFunction } from 'express';
import { AdminUsersService } from './admin-users.service';

const usersService = new AdminUsersService();

export class AdminUsersController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await usersService.listUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.getUserDetail(req.params.id as string);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
}
