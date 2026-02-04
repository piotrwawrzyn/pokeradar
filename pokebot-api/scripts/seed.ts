/**
 * Seed script: Copies products from source DB, creates a user and watch entries in target DB.
 *
 * Usage:
 *   SOURCE_URI=<source> TARGET_URI=<target> npx ts-node scripts/seed.ts <email> [displayName]
 */

import mongoose from 'mongoose';

const SOURCE_URI = "mongodb+srv://REDACTED:REDACTED@REDACTED/pokebot";
const TARGET_URI = "mongodb+srv://REDACTED:REDACTED@REDACTED/pokebot-v2";

if (!SOURCE_URI || !TARGET_URI) {
  console.error('Both SOURCE_URI and TARGET_URI environment variables are required');
  process.exit(1);
}

async function seed() {
  const email = process.argv[2];
  const displayName = process.argv[3] || 'Seed User';

  if (!email) {
    console.error('Usage: npx ts-node scripts/seed.ts <email> [displayName]');
    process.exit(1);
  }

  // Connect to both databases
  const sourceConn = mongoose.createConnection(SOURCE_URI!);
  const targetConn = mongoose.createConnection(TARGET_URI!);

  await Promise.all([
    new Promise<void>((resolve) => sourceConn.once('connected', resolve)),
    new Promise<void>((resolve) => targetConn.once('connected', resolve)),
  ]);
  console.log('Connected to source (pokebot) and target (pokebot-v2)');

  // Define schemas inline to use with specific connections
  const productSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    search: {
      phrases: { type: [String], required: true },
      exclude: { type: [String], default: [] },
    },
    price: {
      max: { type: Number, required: true },
      min: { type: Number },
    },
  });

  const userSchema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      displayName: { type: String, required: true },
      telegramChatId: { type: String, default: null },
      telegramLinkToken: { type: String, default: null },
    },
    { timestamps: true }
  );

  const watchEntrySchema = new mongoose.Schema(
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      productId: { type: String, required: true },
      maxPrice: { type: Number, required: true },
    },
    { timestamps: true }
  );
  watchEntrySchema.index({ userId: 1, productId: 1 }, { unique: true });

  const SourceProduct = sourceConn.model('WatchlistProduct', productSchema);
  const TargetProduct = targetConn.model('WatchlistProduct', productSchema);
  const TargetUser = targetConn.model('User', userSchema);
  const TargetWatchEntry = targetConn.model('UserWatchEntry', watchEntrySchema);

  // 1. Copy products from source to target
  const products = await SourceProduct.find({}).lean();
  console.log(`Found ${products.length} products in source DB`);

  let copied = 0;
  for (const product of products) {
    try {
      await TargetProduct.create({
        id: product.id,
        name: product.name,
        search: product.search,
        price: product.price,
      });
      copied++;
    } catch (err: any) {
      if (err.code === 11000) {
        // Already exists in target
      } else {
        throw err;
      }
    }
  }
  console.log(`Copied ${copied} products to target DB (${products.length - copied} already existed)`);

  // 2. Create or find user in target
  let user = await TargetUser.findOne({ email });
  if (user) {
    console.log(`User already exists: ${user.email} (${user._id})`);
  } else {
    user = await TargetUser.create({
      googleId: `seed-${Date.now()}`,
      email,
      displayName,
    });
    console.log(`Created user: ${user.email} (${user._id})`);
  }

  // 3. Create watch entries in target
  let created = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      await TargetWatchEntry.create({
        userId: user._id,
        productId: product.id,
        maxPrice: product.price!.max,
      });
      created++;
      console.log(`  + ${product.name} (maxPrice: ${product.price!.max})`);
    } catch (err: any) {
      if (err.code === 11000) {
        skipped++;
        console.log(`  ~ ${product.name} (already exists, skipped)`);
      } else {
        throw err;
      }
    }
  }

  console.log(`\nDone: ${copied} products copied, ${created} watch entries created, ${skipped} skipped`);

  await sourceConn.close();
  await targetConn.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
