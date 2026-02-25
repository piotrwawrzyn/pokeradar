/**
 * Phase 2 Migration: ProductType search → matchingProfile
 *
 * Converts:
 *   search.phrases  →  matchingProfile.required  (split each phrase into individual tokens)
 *   search.exclude  →  matchingProfile.forbidden
 *
 * Usage:
 *   MONGODB_URI=<uri> npx tsx scripts/migrate-product-types.ts
 *   MONGODB_URI=<uri> npx tsx scripts/migrate-product-types.ts --dry-run
 */

import mongoose from 'mongoose';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db!;
  const collection = db.collection('producttypes');

  const types = await collection.find({}).toArray();
  console.log(`Found ${types.length} ProductType documents`);

  let migrated = 0;
  let skipped = 0;

  for (const type of types) {
    // Skip if already migrated (has matchingProfile but no search)
    if (type.matchingProfile && !type.search) {
      console.log(`  SKIP (already migrated): ${type.id}`);
      skipped++;
      continue;
    }

    const phrases: string[] = type.search?.phrases ?? [];
    const exclude: string[] = type.search?.exclude ?? [];

    // Split each phrase into individual tokens
    // ProductType phrases were like "Booster Box", "Elite Trainer Box" — each becomes tokens
    const required = [
      ...new Set(phrases.flatMap((p: string) => p.toLowerCase().split(/\s+/)).filter(Boolean)),
    ];

    const forbidden = exclude.map((e: string) => e.toLowerCase());

    const matchingProfile = { required, forbidden };

    console.log(`  ${DRY_RUN ? '[DRY-RUN] ' : ''}${type.id}:`);
    console.log(`    phrases  → required:  [${required.join(', ')}]`);
    console.log(`    exclude  → forbidden: [${forbidden.join(', ')}]`);

    if (!DRY_RUN) {
      await collection.updateOne(
        { _id: type._id },
        {
          $set: { matchingProfile },
          $unset: { search: '' },
        },
      );
    }

    migrated++;
  }

  console.log('\n=== Summary ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already migrated): ${skipped}`);
  if (DRY_RUN) {
    console.log('DRY-RUN: No changes were written to the database.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
