import sharp from 'sharp';
import { cloudinary } from '../../config/cloudinary';
import { env } from '../../config/env';
import { AppError } from '../middleware/error.middleware';

const MAX_DIMENSION = 400;

export class ImageService {
  async validateAndUpload(buffer: Buffer, folder: string): Promise<string> {
    if (!env.CLOUDINARY_CLOUD_NAME) {
      throw new AppError(500, 'Image upload not configured: Cloudinary credentials missing');
    }

    const metadata = await sharp(buffer).metadata();

    if (metadata.format !== 'png') {
      throw new AppError(400, 'Image must be PNG format');
    }

    if (metadata.width !== metadata.height) {
      throw new AppError(400, 'Image must be square (equal width and height)');
    }

    let processedBuffer = buffer;
    if (metadata.width! > MAX_DIMENSION) {
      processedBuffer = await sharp(buffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION)
        .png()
        .toBuffer();
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `pokeradar/${folder}`, format: 'png', resource_type: 'image' },
        (error, result) => {
          if (error) reject(new AppError(500, 'Image upload failed'));
          else resolve(result!.secure_url);
        },
      );
      stream.end(processedBuffer);
    });
  }
}
