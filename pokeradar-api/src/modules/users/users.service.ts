import crypto from 'crypto';
import { Types } from 'mongoose';
import type { ChangeStreamUpdateDocument } from 'mongodb';
import { clerkClient } from '@clerk/express';
import {
  UserModel,
  UserWatchEntryModel,
  NotificationStateModel,
  NotificationModel,
} from '@pokeradar/shared';
import { UserProfileResponse, LinkTokenResponse } from '../../shared/types';
import { NotFoundError } from '../../shared/middleware';

export interface UnlinkResult {
  watchlistCleared: boolean;
}

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

  async unlinkTelegram(userId: string): Promise<UnlinkResult> {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: { 'telegram.channelId': null, 'telegram.linkToken': null } },
      { new: true },
    );

    if (!user) throw new NotFoundError('User not found');

    const hasOtherChannel = user.discord?.channelId != null;
    if (!hasOtherChannel) {
      return this.clearWatchlistForUser(userId);
    }

    return { watchlistCleared: false };
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

  async unlinkDiscord(userId: string): Promise<UnlinkResult> {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: { 'discord.channelId': null, 'discord.linkToken': null } },
      { new: true },
    );

    if (!user) throw new NotFoundError('User not found');

    const hasOtherChannel = user.telegram?.channelId != null;
    if (!hasOtherChannel) {
      return this.clearWatchlistForUser(userId);
    }

    return { watchlistCleared: false };
  }

  private async clearWatchlistForUser(userId: string): Promise<UnlinkResult> {
    const entries = await UserWatchEntryModel.find({
      userId: new Types.ObjectId(userId),
    }).lean();

    if (entries.length === 0) {
      return { watchlistCleared: false };
    }

    const productIds = entries.map((e) => e.productId);

    await Promise.all([
      UserWatchEntryModel.deleteMany({ userId: new Types.ObjectId(userId) }),
      NotificationStateModel.deleteMany({ userId, productId: { $in: productIds } }),
      NotificationModel.deleteMany({
        userId,
        'payload.productId': { $in: productIds },
        status: 'pending',
      }),
    ]);

    return { watchlistCleared: true };
  }

  watchForLinkConfirmation(userId: string, onLinked: () => void): () => void {
    // Only filter by operationType and userId in the pipeline.
    // We cannot filter on "discord.channelId" / "telegram.channelId" inside
    // updatedFields via the pipeline because MongoDB stores those as literal
    // dot-notation keys (e.g. the key IS "discord.channelId"), not nested
    // objects — so dot-path traversal in $match never matches them.
    const pipeline = [
      {
        $match: {
          operationType: 'update',
          'documentKey._id': new Types.ObjectId(userId),
        },
      },
    ];

    const stream = UserModel.watch(pipeline);
    let fired = false;

    stream.on('change', (change: ChangeStreamUpdateDocument) => {
      if (fired) return;
      const fields: Record<string, unknown> = change.updateDescription?.updatedFields ?? {};
      if ('discord.channelId' in fields || 'telegram.channelId' in fields) {
        fired = true;
        onLinked();
        stream.close();
      }
    });

    stream.on('error', () => stream.close());

    return () => stream.close();
  }
}
