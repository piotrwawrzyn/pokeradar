import { clerkClient } from '@clerk/express';
import { UserModel } from '../../infrastructure/database/models';
import { UserProfileResponse } from '../../shared/types';

export class AuthService {
  async getUserProfile(
    userId: string,
    clerkId: string
  ): Promise<UserProfileResponse | null> {
    const [user, clerkUser] = await Promise.all([
      UserModel.findById(userId).lean(),
      clerkClient.users.getUser(clerkId),
    ]);
    if (!user) return null;

    return {
      id: user._id.toString(),
      email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
      displayName: clerkUser.fullName ?? '',
      telegramLinked: user.telegramChatId !== null,
      telegramLinkToken: user.telegramLinkToken ?? null,
    };
  }
}
