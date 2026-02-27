import mongoose, { Schema, Document } from 'mongoose';

export interface IProductSetDoc extends Document {
  id: string;
  name: string;
  series: string;
  imageUrl: string;
  releaseDate?: Date;
  /** Official set number, e.g. "SV8" or "ME2.5". Used for abbreviation expansion in the matching pipeline. */
  setNumber: string;
  /** Three-letter set abbreviation used in card databases, e.g. "SSP" or "PFL". Used for abbreviation expansion. */
  setAbbreviation: string;
}

const ProductSetSchema = new Schema<IProductSetDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  series: { type: String, required: true },
  imageUrl: { type: String, required: true },
  releaseDate: { type: Date },
  setNumber: { type: String, required: true },
  setAbbreviation: { type: String, required: true },
});

export const ProductSetModel = mongoose.model<IProductSetDoc>('ProductSet', ProductSetSchema);
