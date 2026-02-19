import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

const authService = new AuthService();

export class AuthController {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await authService.getUserProfile(
        req.user!.userId,
        req.user!.clerkId
      );
      if (!profile) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }
}
