/**
 * ProductType MongoDB model.
 * Represents a category of Pokemon products (e.g. "Booster Box", "Poster Collection").
 * Carries a MatchingProfile that products inherit for title matching.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IMatchingProfile {
  /** Tokens that MUST appear in a title (joined with set name to form the search phrase). */
  required: string[];
  /** Tokens that MUST NOT appear in a title. */
  forbidden: string[];
  /** Optional title-level synonym expansions applied before matching. */
  synonyms?: Record<string, string>;
}

export interface IProductTypeDoc extends Document {
  id: string;
  name: string;
  matchingProfile: IMatchingProfile;
}

const ProductTypeSchema = new Schema<IProductTypeDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  matchingProfile: {
    required: { type: [String], default: [] },
    forbidden: { type: [String], default: [] },
    synonyms: { type: Map, of: String },
  },
});

export const ProductTypeModel = mongoose.model<IProductTypeDoc>('ProductType', ProductTypeSchema);
