import crypto from 'crypto';
import { clerkClient } from '@clerk/express';
import { UserModel } from '../../infrastructure/database/models';
import { UserProfileResponse, LinkTokenResponse } from '../../shared/types';
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
      telegram: {
        linked: user.telegram?.channelId !== null && user.telegram?.channelId !== undefined,
        linkToken: user.telegram?.linkToken ?? null,
      },
      discord: {
        linked: user.discord?.channelId !== null && user.discord?.channelId !== undefined,
        linkToken: user.discord?.linkToken ?? null,
      },
    };
  }

  async generateTelegramLinkToken(userId: string): Promise<LinkTokenResponse> {
    const token = crypto.randomUUID();

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { 'telegram.linkToken': token } },
      { new: true },
    );

    if (!user) throw new NotFoundError('User not found');

    return { linkToken: token };
  }

  async unlinkTelegram(userId: string): Promise<void> {
    const result = await UserModel.updateOne(
      { _id: userId },
      { $set: { 'telegram.channelId': null, 'telegram.linkToken': null } },
    );

    if (result.matchedCount === 0) throw new NotFoundError('User not found');
  }

  async generateDiscordLinkToken(userId: string): Promise<LinkTokenResponse> {
    const token = crypto.randomUUID();

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { 'discord.linkToken': token } },
      { new: true },
    );

    if (!user) throw new NotFoundError('User not found');

    return { linkToken: token };
  }

  async unlinkDiscord(userId: string): Promise<void> {
    const result = await UserModel.updateOne(
      { _id: userId },
      { $set: { 'discord.channelId': null, 'discord.linkToken': null } },
    );

    if (result.matchedCount === 0) throw new NotFoundError('User not found');
  }
}
