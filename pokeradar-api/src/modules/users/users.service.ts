import crypto from 'crypto';
import { clerkClient } from '@clerk/express';
import { UserModel } from '../../infrastructure/database/models';
import { UserProfileResponse, TelegramLinkTokenResponse } from '../../shared/types';
import { NotFoundError } from '../../shared/middleware';

export class UsersService {
  async getProfile(userId: string, clerkId: string): Promise<UserProfileResponse> {
    const [user, clerkUser] = await Promise.all([
      UserModel.findById(userId).lean(),
      clerkClient.users.getUser(clerkId),
    ]);

    if (!user) throw new NotFoundError('User not found');

    return {
      id: user._id.toString(),
      email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
      displayName: clerkUser.fullName ?? '',
      telegramLinked: user.telegramChatId !== null,
      telegramLinkToken: user.telegramLinkToken ?? null,
    };
  }

  async generateLinkToken(userId: string): Promise<TelegramLinkTokenResponse> {
    const token = crypto.randomUUID();

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { telegramLinkToken: token } },
      { new: true }
    );

    if (!user) throw new NotFoundError('User not found');

    return { telegramLinkToken: token };
  }

  async unlinkTelegram(userId: string): Promise<void> {
    const result = await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          telegramChatId: null,
          telegramLinkToken: null,
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('User not found');
    }
  }
}
