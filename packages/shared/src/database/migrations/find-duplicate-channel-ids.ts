/**
 * Diagnostic script: find users sharing the same Discord or Telegram channelId.
 *
 * Run BEFORE deploying the unique index migration to identify conflicts.
 * Any duplicates must be resolved manually (unlink one side) before the
 * unique sparse index can be created.
 *
 * Usage:
 *   MONGODB_URI=<uri> npx tsx packages/shared/src/database/migrations/find-duplicate-channel-ids.ts
 */

import mongoose from 'mongoose';
import { UserModel } from '../models/user.model';

async function findDuplicates(field: string): Promise<{ id: string; count: number }[]> {
  return UserModel.aggregate([
    { $match: { [field]: { $ne: null } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 }, userIds: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $project: { _id: 0, id: '$_id', count: 1, userIds: 1 } },
  ]);
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI environment variable');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  const discordDups = await findDuplicates('discord.channelId');
  const telegramDups = await findDuplicates('telegram.channelId');

  if (discordDups.length === 0 && telegramDups.length === 0) {
    console.log('No duplicate channel IDs found. Safe to deploy unique indexes.');
  } else {
    if (discordDups.length > 0) {
      console.log(`Found ${discordDups.length} duplicate Discord channelId(s):`);
      for (const dup of discordDups) {
        console.log(`  channelId=${dup.id}  count=${dup.count}`);
      }
    }
    if (telegramDups.length > 0) {
      console.log(`Found ${telegramDups.length} duplicate Telegram channelId(s):`);
      for (const dup of telegramDups) {
        console.log(`  channelId=${dup.id}  count=${dup.count}`);
      }
    }
    console.log('\nResolve duplicates before deploying the unique index.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
