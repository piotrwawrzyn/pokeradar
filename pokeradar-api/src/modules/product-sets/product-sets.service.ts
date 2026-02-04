import { ProductSetModel } from '../../infrastructure/database/models';
import { ProductSet } from '../../shared/types';

export class ProductSetsService {
  async listAll(): Promise<ProductSet[]> {
    const docs = await ProductSetModel.find()
      .select('id name series imageUrl releaseDate')
      .lean();
    return docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      series: doc.series,
      imageUrl: doc.imageUrl,
      releaseDate: doc.releaseDate,
    }));
  }

  async getById(id: string): Promise<ProductSet | null> {
    const doc = await ProductSetModel.findOne({ id })
      .select('id name series imageUrl releaseDate')
      .lean();
    if (!doc) return null;
    return {
      id: doc.id,
      name: doc.name,
      series: doc.series,
      imageUrl: doc.imageUrl,
      releaseDate: doc.releaseDate,
    };
  }
}
