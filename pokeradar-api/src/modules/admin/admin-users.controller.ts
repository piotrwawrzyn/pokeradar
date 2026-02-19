import { Request, Response, NextFunction } from 'express';
import { AdminUsersService } from './admin-users.service';

const usersService = new AdminUsersService();

export class AdminUsersController {
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req.query.search as string) ?? '';
      const users = await usersService.searchUsers(query);
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.getUserDetail(req.params.clerkId as string);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }
}
