/**
 * ProductType MongoDB model.
 * Represents a category of Pokemon products (e.g. "Booster Box", "Poster Collection").
 * Carries a matching profile that defines what tokens must/must not appear in product titles.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IProductTypeDoc extends Document {
  id: string;
  name: string;
  matchingProfile: {
    required: string[];
    forbidden: string[];
  };
}

const ProductTypeSchema = new Schema<IProductTypeDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  matchingProfile: {
    required: { type: [String], default: [] },
    forbidden: { type: [String], default: [] },
  },
});

export const ProductTypeModel = mongoose.model<IProductTypeDoc>('ProductType', ProductTypeSchema);
