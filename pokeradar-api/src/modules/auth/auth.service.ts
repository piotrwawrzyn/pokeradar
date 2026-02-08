import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UserModel, IUserDoc } from '../../infrastructure/database/models';
import { AuthPayload, UserProfileResponse } from '../../shared/types';

export class AuthService {
  generateToken(user: IUserDoc): string {
    const payload: AuthPayload = {
      userId: user._id.toString(),
      email: user.email,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  async getUserProfile(userId: string): Promise<UserProfileResponse | null> {
    const user = await UserModel.findById(userId).lean();
    if (!user) return null;

    return {
      id: user._id.toString(),
      email: user.email,
      displayName: user.displayName,
      telegramLinked: user.telegramChatId !== null,
      telegramLinkToken: user.telegramLinkToken ?? null,
    };
  }
}
