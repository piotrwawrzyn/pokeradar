import { ProductSetModel } from '../../infrastructure/database/models';
import { ProductSet } from '../../shared/types';

export class ProductSetsService {
  async listAll(): Promise<ProductSet[]> {
    const docs = await ProductSetModel.find()
      .select('id name series imageUrl releaseDate setNumber setAbbreviation')
      .lean();
    return docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      series: doc.series,
      imageUrl: doc.imageUrl,
      releaseDate: doc.releaseDate,
      setNumber: doc.setNumber,
      setAbbreviation: doc.setAbbreviation,
    }));
  }

  async getById(id: string): Promise<ProductSet | null> {
    const doc = await ProductSetModel.findOne({ id })
      .select('id name series imageUrl releaseDate setNumber setAbbreviation')
      .lean();
    if (!doc) return null;
    return {
      id: doc.id,
      name: doc.name,
      series: doc.series,
      imageUrl: doc.imageUrl,
      releaseDate: doc.releaseDate,
      setNumber: doc.setNumber,
      setAbbreviation: doc.setAbbreviation,
    };
  }
}
