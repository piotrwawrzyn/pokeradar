/**
 * ProductType MongoDB model.
 * Represents a category of Pokemon products (e.g. "Booster Box", "Poster Collection").
 * Carries search configuration that products can inherit.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IProductTypeDoc extends Document {
  id: string;
  name: string;
  search: {
    phrases?: string[];
    exclude?: string[];
  };
}

const ProductTypeSchema = new Schema<IProductTypeDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  search: {
    phrases: { type: [String] },
    exclude: { type: [String] },
  },
});

export const ProductTypeModel = mongoose.model<IProductTypeDoc>('ProductType', ProductTypeSchema);
