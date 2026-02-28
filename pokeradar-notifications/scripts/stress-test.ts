/**
 * Stress-test script for the notification delivery pipeline.
 *
 * Inserts a batch of fake notifications into MongoDB, triggering the
 * change stream watcher in the running notifications service. Measures
 * how long it takes for all notifications to reach 'sent' status.
 *
 * Prerequisites:
 *   - The notifications service must be running (it processes via change stream)
 *   - MONGODB_URI env var must be set (or present in .env)
 *
 * Usage (run from pokeradar-notifications/):
 *
 *   PowerShell:
 *     $env:MONGODB_URI="<uri>"; npx tsx scripts/stress-test.ts [options]
 *
 *   Bash:
 *     MONGODB_URI=<uri> npx tsx scripts/stress-test.ts [options]
 *
 * Options:
 *   --users     Number of users to simulate (default: 10)
 *   --per-user  Notifications per user (default: 5)
 *   --timeout   Max wait time in seconds (default: 300)
 *
 * Examples:
 *   npx tsx scripts/stress-test.ts --users 2 --per-user 5
 *   npx tsx scripts/stress-test.ts --users 100 --per-user 3 --timeout 600
 */

import mongoose from 'mongoose';
import { NotificationModel, UserModel } from '@pokeradar/shared';

// ─── CLI args ────────────────────────────────────────────────────────────────

function getArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return parseInt(process.argv[idx + 1], 10) || fallback;
}

const USER_COUNT = getArg('users', 10);
const PER_USER = getArg('per-user', 5);
const TIMEOUT_S = getArg('timeout', 300);
const TOTAL = USER_COUNT * PER_USER;

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI environment variable');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  // Find real users that have at least one channel linked
  const users = await UserModel.find({
    $or: [{ 'telegram.channelId': { $ne: null } }, { 'discord.channelId': { $ne: null } }],
  })
    .select('_id telegram.channelId discord.channelId')
    .limit(USER_COUNT)
    .lean();

  if (users.length === 0) {
    console.error('No users with linked channels found. Link at least one account first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const actualUserCount = Math.min(USER_COUNT, users.length);
  const actualTotal = actualUserCount * PER_USER;

  console.log(`Stress test config:`);
  console.log(`  Users:              ${actualUserCount} (requested ${USER_COUNT})`);
  console.log(`  Notifications/user: ${PER_USER}`);
  console.log(`  Total notifications: ${actualTotal}`);

  const channelCounts = users.reduce(
    (acc, u) => {
      if (u.telegram?.channelId) acc.telegram++;
      if (u.discord?.channelId) acc.discord++;
      return acc;
    },
    { telegram: 0, discord: 0 },
  );
  const expectedDeliveries = channelCounts.telegram * PER_USER + channelCounts.discord * PER_USER;
  console.log(
    `  Expected deliveries: ~${expectedDeliveries} (${channelCounts.telegram} telegram users, ${channelCounts.discord} discord users)`,
  );
  console.log(`  Timeout:            ${TIMEOUT_S}s\n`);

  // Build notification documents
  const docs: Array<{
    userId: string;
    status: 'pending';
    payload: {
      productName: string;
      shopName: string;
      shopId: string;
      productId: string;
      price: number;
      maxPrice: number;
      productUrl: string;
    };
    deliveries: never[];
  }> = [];
  for (const user of users) {
    for (let i = 0; i < PER_USER; i++) {
      docs.push({
        userId: user._id.toString(),
        status: 'pending' as const,
        payload: {
          productName: `[STRESS TEST] Product ${i + 1}`,
          shopName: 'Stress Test Shop',
          shopId: 'stress-test',
          productId: `stress-test-${i}`,
          price: 99.99,
          maxPrice: 150.0,
          productUrl: 'https://example.com/stress-test',
        },
        deliveries: [],
      });
    }
  }

  // Insert all at once (mirrors scraper's insertBatch behavior)
  const startTime = Date.now();
  console.log(`Inserting ${actualTotal} notifications...`);
  const inserted = await NotificationModel.insertMany(docs, { ordered: false });
  const insertedIds = inserted.map((d) => d._id);
  const insertMs = Date.now() - startTime;
  console.log(`Inserted in ${insertMs}ms. Waiting for processing...\n`);

  // Poll for completion
  const pollIntervalMs = 1000;
  const deadline = Date.now() + TIMEOUT_S * 1000;
  let lastPending = actualTotal;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const counts = await NotificationModel.aggregate([
      { $match: { _id: { $in: insertedIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusMap: Record<string, number> = {};
    for (const c of counts) {
      statusMap[c._id] = c.count;
    }

    const sent = statusMap['sent'] ?? 0;
    const sending = statusMap['sending'] ?? 0;
    const pending = statusMap['pending'] ?? 0;
    const failed = statusMap['failed'] ?? 0;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (pending + sending !== lastPending) {
      console.log(
        `  [${elapsed}s] sent=${sent} sending=${sending} pending=${pending} failed=${failed}`,
      );
      lastPending = pending + sending;
    }

    if (sent + failed >= actualTotal) {
      const totalMs = Date.now() - startTime;
      const deliveryMs = totalMs - insertMs;
      const throughput = (expectedDeliveries / (deliveryMs / 1000)).toFixed(1);

      console.log(`\n--- Results ---`);
      console.log(`  Total time:       ${(totalMs / 1000).toFixed(1)}s`);
      console.log(`  Insert time:      ${(insertMs / 1000).toFixed(1)}s`);
      console.log(`  Delivery time:    ${(deliveryMs / 1000).toFixed(1)}s`);
      console.log(`  Sent:             ${sent}`);
      console.log(`  Failed:           ${failed}`);
      console.log(`  Deliveries:       ~${expectedDeliveries}`);
      console.log(`  Throughput:       ~${throughput} deliveries/sec`);
      break;
    }
  }

  if (Date.now() >= deadline) {
    console.error(`\nTimeout after ${TIMEOUT_S}s — not all notifications were processed.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
