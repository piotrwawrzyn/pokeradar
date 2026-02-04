import mongoose, { Schema, Document } from 'mongoose';

export interface IProductSetDoc extends Document {
  id: string;
  name: string;
  series: string;
  imageUrl: string;
  releaseDate?: Date;
}

const ProductSetSchema = new Schema<IProductSetDoc>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  series: { type: String, required: true },
  imageUrl: { type: String, required: true },
  releaseDate: { type: Date },
});

export const ProductSetModel = mongoose.model<IProductSetDoc>(
  'ProductSet',
  ProductSetSchema
);
