import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../../infrastructure/database/models';

export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await UserModel.findById(req.user!.userId).lean();
    if (!user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}
