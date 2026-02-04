/**
 * Migration script: Creates product sets and assigns products to their sets.
 *
 * Usage:
 *   npx ts-node scripts/migrate-sets.ts
 */

import mongoose from 'mongoose';

const TARGET_URI = "mongodb+srv://REDACTED:REDACTED@REDACTED/pokebot-v2";

interface ProductSetData {
  id: string;
  name: string;
  series: string;
  imageUrl: string;
  releaseDate?: string;
}

const PRODUCT_SETS: ProductSetData[] = [
  {
    id: 'sv-151',
    name: '151',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv3pt5/logo.png',
    releaseDate: '2023-09-22',
  },
  {
    id: 'sv-surging-sparks',
    name: 'Surging Sparks',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv8/logo.png',
    releaseDate: '2024-11-08',
  },
  {
    id: 'sv-prismatic-evolutions',
    name: 'Prismatic Evolutions',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv8/logo.png',
    releaseDate: '2025-01-17',
  },
  {
    id: 'sv-journey-together',
    name: 'Journey Together',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv9/logo.png',
    releaseDate: '2025-03-28',
  },
  {
    id: 'sv-destined-rivals',
    name: 'Destined Rivals',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv10/logo.png',
    releaseDate: '2025-05-30',
  },
  {
    id: 'sv-phantasmal-flames',
    name: 'Phantasmal Flames',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv8/logo.png',
    releaseDate: '2025-08-08',
  },
  {
    id: 'sv-mega-evolution',
    name: 'Mega Evolution',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv8/logo.png',
    releaseDate: '2025-09-19',
  },
  {
    id: 'sv-ascended-heroes',
    name: 'Ascended Heroes',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv8/logo.png',
    releaseDate: '2025-11-07',
  },
  {
    id: 'sv-white-flare',
    name: 'White Flare',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv8/logo.png',
    releaseDate: '2026-01-30',
  },
  {
    id: 'sv-black-bolt',
    name: 'Black Bolt',
    series: 'Scarlet & Violet',
    imageUrl: 'https://images.pokemontcg.io/sv8/logo.png',
    releaseDate: '2026-01-30',
  },
];

const PLACEHOLDER_IMAGE = 'https://d1i787aglh9bmb.cloudfront.net/assets/img/sv-expansions/sv08/collections/en-us/sv08-booster-display-en-2x.png';

// Maps product ID to its set ID
const PRODUCTS: Record<string, { setId: string; imageUrl: string }> = {
  'prismatic-evolutions-booster-bundle': { setId: 'sv-prismatic-evolutions', imageUrl: PLACEHOLDER_IMAGE },
  'ascended-heroes-booster-bundle': { setId: 'sv-ascended-heroes', imageUrl: PLACEHOLDER_IMAGE },
  'ascended-heroes-elite-trainer-box': { setId: 'sv-ascended-heroes', imageUrl: PLACEHOLDER_IMAGE },
  'ascended-heroes-mini-tin-display': { setId: 'sv-ascended-heroes', imageUrl: PLACEHOLDER_IMAGE },
  'white-flare-booster-bundle': { setId: 'sv-white-flare', imageUrl: PLACEHOLDER_IMAGE },
  'black-bolt-booster-bundle': { setId: 'sv-black-bolt', imageUrl: PLACEHOLDER_IMAGE },
  'phantasmal-flames-booster-bundle': { setId: 'sv-phantasmal-flames', imageUrl: PLACEHOLDER_IMAGE },
  'phantasmal-flames-booster-box': { setId: 'sv-phantasmal-flames', imageUrl: PLACEHOLDER_IMAGE },
  '151-booster-bundle': { setId: 'sv-151', imageUrl: PLACEHOLDER_IMAGE },
  '151-mini-tin-display': { setId: 'sv-151', imageUrl: PLACEHOLDER_IMAGE },
  'journey-together-booster-box': { setId: 'sv-journey-together', imageUrl: PLACEHOLDER_IMAGE },
  'surging-sparks-booster-box': { setId: 'sv-surging-sparks', imageUrl: PLACEHOLDER_IMAGE },
  'destined-rivals-booster-box': { setId: 'sv-destined-rivals', imageUrl: PLACEHOLDER_IMAGE },
  'mega-evolution-booster-box': { setId: 'sv-mega-evolution', imageUrl: PLACEHOLDER_IMAGE },
};

async function migrate() {
  const conn = mongoose.createConnection(TARGET_URI);
  await new Promise<void>((resolve) => conn.once('connected', resolve));
  console.log('Connected to pokebot-v2');

  const productSetSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    series: { type: String, required: true },
    imageUrl: { type: String, required: true },
    releaseDate: { type: Date },
  });

  const productSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String },
    imageUrl: { type: String },
    productSetId: { type: String },
    search: { phrases: [String], exclude: [String] },
    price: { max: Number, min: Number },
    disabled: { type: Boolean },
  });

  const ProductSet = conn.model('ProductSet', productSetSchema);
  const Product = conn.model('WatchlistProduct', productSchema);

  // 1. Create product sets
  console.log('\n--- Creating product sets ---');
  let setsCreated = 0;
  let setsSkipped = 0;

  for (const set of PRODUCT_SETS) {
    const result = await ProductSet.updateOne(
      { id: set.id },
      {
        $set: {
          name: set.name,
          series: set.series,
          imageUrl: set.imageUrl,
          releaseDate: set.releaseDate ? new Date(set.releaseDate) : undefined,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      setsCreated++;
      console.log(`  + ${set.name} (${set.id})`);
    } else {
      setsSkipped++;
      console.log(`  ~ ${set.name} (updated)`);
    }
  }

  // 2. Update products with productSetId
  console.log('\n--- Assigning products to sets ---');
  let updated = 0;
  let notFound = 0;

  for (const [productId, { setId, imageUrl }] of Object.entries(PRODUCTS)) {
    const result = await Product.updateOne(
      { id: productId },
      { $set: { productSetId: setId, imageUrl } }
    );
    if (result.matchedCount > 0) {
      updated++;
      console.log(`  ✓ ${productId} → ${setId} (imageUrl set)`);
    } else {
      notFound++;
      console.log(`  ✗ ${productId} (not found in DB)`);
    }
  }

  console.log(`\nDone: ${setsCreated} sets created, ${setsSkipped} sets skipped, ${updated} products updated, ${notFound} products not found`);

  await conn.close();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
