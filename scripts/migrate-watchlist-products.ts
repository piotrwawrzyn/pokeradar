/**
 * Phase 3 Migration: WatchlistProduct search → searchOverride
 *
 * Decision rules:
 *   search.override === true  →  searchOverride.customPhrase = search.phrases.join(' ')
 *   search.phrases (+ has productTypeId)  →  searchOverride.additionalRequired = <non-set tokens>
 *   search.phrases (+ no productTypeId)   →  searchOverride.customPhrase = search.phrases.join(' ')
 *   search.exclude  →  searchOverride.additionalForbidden = search.exclude
 *   $unset: { search: '' }
 *
 * Usage:
 *   MONGODB_URI=<uri> npx tsx scripts/migrate-watchlist-products.ts
 *   MONGODB_URI=<uri> npx tsx scripts/migrate-watchlist-products.ts --dry-run
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
  const productsCollection = db.collection('watchlistproducts');
  const setsCollection = db.collection('productsets');

  // Load set names for token extraction
  const sets = await setsCollection.find({}).toArray();
  const setNameMap = new Map<string, string>(
    sets.map((s) => [s.id as string, (s.name as string).toLowerCase()]),
  );

  const products = await productsCollection.find({}).toArray();
  console.log(`Found ${products.length} WatchlistProduct documents`);

  let migrated = 0;
  let skipped = 0;

  for (const product of products) {
    // Skip if already migrated (has searchOverride but no search)
    if (product.searchOverride && !product.search) {
      console.log(`  SKIP (already migrated): ${product.id}`);
      skipped++;
      continue;
    }

    // Skip if no search field at all (nothing to migrate)
    if (!product.search) {
      console.log(`  SKIP (no search field): ${product.id}`);
      skipped++;
      continue;
    }

    const phrases: string[] = product.search?.phrases ?? [];
    const exclude: string[] = product.search?.exclude ?? [];
    const isOverride: boolean = product.search?.override ?? false;

    const searchOverride: Record<string, unknown> = {};

    if (isOverride) {
      // Full override — store as customPhrase
      searchOverride.customPhrase = phrases.join(' ');
    } else if (phrases.length > 0 && !product.productTypeId) {
      // No type — phrases are standalone, use as customPhrase
      searchOverride.customPhrase = phrases.join(' ');
    } else if (phrases.length > 0 && product.productTypeId) {
      // Has type — try to extract additional tokens beyond the set name
      const setName = product.productSetId ? setNameMap.get(product.productSetId) : undefined;
      const setTokens = setName ? new Set(setName.split(/\s+/).filter(Boolean)) : new Set<string>();

      const additionalRequired = phrases
        .flatMap((p: string) => p.toLowerCase().split(/\s+/))
        .filter((token: string) => token && !setTokens.has(token));

      const unique = [...new Set(additionalRequired)];
      if (unique.length > 0) {
        searchOverride.additionalRequired = unique;
      }
    }

    if (exclude.length > 0) {
      searchOverride.additionalForbidden = exclude.map((e: string) => e.toLowerCase());
    }

    console.log(`  ${DRY_RUN ? '[DRY-RUN] ' : ''}${product.id}:`);
    if (searchOverride.customPhrase) {
      console.log(`    search.phrases (override) → customPhrase: "${searchOverride.customPhrase}"`);
    }
    if (searchOverride.additionalRequired) {
      console.log(
        `    search.phrases → additionalRequired: [${(searchOverride.additionalRequired as string[]).join(', ')}]`,
      );
    }
    if (searchOverride.additionalForbidden) {
      console.log(
        `    search.exclude → additionalForbidden: [${(searchOverride.additionalForbidden as string[]).join(', ')}]`,
      );
    }
    if (Object.keys(searchOverride).length === 0) {
      console.log(`    search existed but was empty — will just $unset`);
    }

    if (!DRY_RUN) {
      const update: Record<string, unknown> = { $unset: { search: '' } };
      if (Object.keys(searchOverride).length > 0) {
        update.$set = { searchOverride };
      }
      await productsCollection.updateOne({ _id: product._id }, update);
    }

    migrated++;
  }

  console.log('\n=== Summary ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped (already migrated or no search): ${skipped}`);
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
