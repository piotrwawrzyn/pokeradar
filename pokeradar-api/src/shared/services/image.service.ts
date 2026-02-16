import sharp from 'sharp';
import { cloudinary } from '../../config/cloudinary';
import { env } from '../../config/env';
import { AppError } from '../middleware/error.middleware';

const MAX_DIMENSION = 400;

export class ImageService {
  async validateAndUpload(buffer: Buffer, folder: string, requireSquare = true): Promise<string> {
    if (!env.CLOUDINARY_CLOUD_NAME) {
      throw new AppError(500, 'Image upload not configured: Cloudinary credentials missing');
    }

    const metadata = await sharp(buffer).metadata();

    if (!['png', 'webp'].includes(metadata.format || '')) {
      throw new AppError(400, 'Image must be PNG or WebP format');
    }

    if (requireSquare && metadata.width !== metadata.height) {
      throw new AppError(400, 'Image must be square (equal width and height)');
    }

    let processedBuffer = buffer;
    let needsConversion = metadata.format === 'webp';
    const needsResize = metadata.width! > MAX_DIMENSION || metadata.height! > MAX_DIMENSION;

    if (needsResize || needsConversion) {
      let sharpInstance = sharp(buffer);

      if (needsResize) {
        const maxDim = Math.max(metadata.width!, metadata.height!);
        const scale = MAX_DIMENSION / maxDim;
        const newWidth = Math.round(metadata.width! * scale);
        const newHeight = Math.round(metadata.height! * scale);
        sharpInstance = sharpInstance.resize(newWidth, newHeight);
      }

      processedBuffer = await sharpInstance.png().toBuffer();
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `${env.CLOUDINARY_FOLDER}/${folder}`, format: 'png', resource_type: 'image' },
        (error, result) => {
          if (error) reject(new AppError(500, 'Image upload failed'));
          else resolve(result!.secure_url);
        },
      );
      stream.end(processedBuffer);
    });
  }
}
