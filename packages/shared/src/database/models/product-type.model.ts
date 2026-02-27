/**
 * ProductType MongoDB model.
 * Represents a category of Pokemon products (e.g. "Booster Box", "Poster Collection").
 * Carries a matching profile that defines what tokens must/must not appear in product titles.
 *
 * The `contains` array lists IDs of product types that are direct ingredients of this type.
 * For example, a Tin contains Boosters, so its `contains` would be ["booster"].
 * This is used by the matching pipeline to prefer container types over their ingredients
 * when both appear in a product title.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IProductTypeDoc extends Document {
  id: string;
  name: string;
  matchingProfile: {
    required: string[];
    forbidden: string[];
  };
  contains: string[];
}

const ProductTypeSchema = new Schema<IProductTypeDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  matchingProfile: {
    required: { type: [String], default: [] },
    forbidden: { type: [String], default: [] },
  },
  contains: { type: [String], default: [] },
});

export const ProductTypeModel = mongoose.model<IProductTypeDoc>('ProductType', ProductTypeSchema);
