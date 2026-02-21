import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { sessionClaims } = getAuth(req);
  const isAdmin = (sessionClaims?.metadata as Record<string, unknown>)?.isAdmin === true;
  if (!isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
