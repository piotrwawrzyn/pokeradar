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
      telegram: {
        linked: (user.telegram?.channelId ?? null) !== null,
        linkToken: user.telegram?.linkToken ?? null,
      },
      discord: {
        linked: (user.discord?.channelId ?? null) !== null,
        linkToken: user.discord?.linkToken ?? null,
      },
    };
  }
}
