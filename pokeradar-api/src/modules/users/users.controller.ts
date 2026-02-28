import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';

const usersService = new UsersService();

export class UsersController {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await usersService.getProfile(req.user!.userId, req.user!.clerkId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  async generateTelegramLinkToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.generateTelegramLinkToken(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async unlinkTelegram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await usersService.unlinkTelegram(req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async generateDiscordLinkToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await usersService.generateDiscordLinkToken(req.user!.userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async unlinkDiscord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await usersService.unlinkDiscord(req.user!.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async streamLinkStatus(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const cleanup = usersService.watchForLinkConfirmation(req.user!.userId, () => {
      res.write('data: linked\n\n');
      res.end();
    });

    req.on('close', cleanup);
  }
}
