import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { AuthService } from './auth.service';
import { IUserDoc } from '../../infrastructure/database/models';

const authService = new AuthService();

export class AuthController {
  googleCallback(req: Request, res: Response): void {
    const passportUser = req.user as Express.User & { _doc: IUserDoc };
    const token = authService.generateToken(passportUser._doc);
    res.redirect(`${env.CORS_ORIGIN}/auth/callback?token=${token}`);
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await authService.getUserProfile(req.user!.userId);
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
