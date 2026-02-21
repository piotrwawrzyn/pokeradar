import { Request, Response, NextFunction } from 'express';
import { requireAuth, getAuth } from '@clerk/express';
import { UserModel } from '../../infrastructure/database/models';

// Augment express-serve-static-core so req.user is typed throughout the app.
// Placed here (rather than a standalone .d.ts) so ts-node-dev picks it up
// via the import graph instead of relying on project-wide include scanning.
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      clerkId: string;
    };
  }
}

// Step 1: Clerk token verification — handles 401 automatically
export const clerkAuthMiddleware = requireAuth();

// Step 2: Resolve Clerk identity → MongoDB telegram record
// Creates a new record on first authenticated request (lazy provision)
export async function resolveDbUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await UserModel.findOneAndUpdate(
    { clerkId },
    { $setOnInsert: { clerkId } },
    { upsert: true, new: true, lean: true },
  );
  if (!user) {
    res.status(500).json({ error: 'Failed to resolve user' });
    return;
  }
  req.user = { userId: user._id.toString(), clerkId };
  next();
}

// Combined — drop-in replacement for old authMiddleware
export const authMiddleware = [clerkAuthMiddleware, resolveDbUser];
