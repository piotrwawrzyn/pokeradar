import sharp from 'sharp';
import { cloudinary } from '../../config/cloudinary';
import { env } from '../../config/env';
import { AppError } from '../middleware/error.middleware';

const MAX_DIMENSION = 400;

interface UploadOptions {
  publicId?: string;
  requireSquare?: boolean;
}

/**
 * Extracts the Cloudinary public_id from a secure_url.
 *
 * Example:
 *   "https://res.cloudinary.com/dd0ogah1u/image/upload/v1234/pokeradar-prod/products/my-slug.png"
 *   → "pokeradar-prod/products/my-slug"
 */
function extractPublicId(imageUrl: string): string | null {
  const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
  return match?.[1] ?? null;
}

export class ImageService {
  async validateAndUpload(
    buffer: Buffer,
    folder: string,
    options?: UploadOptions,
  ): Promise<string> {
    if (!env.CLOUDINARY_CLOUD_NAME) {
      throw new AppError(500, 'Image upload not configured: Cloudinary credentials missing');
    }

    const requireSquare = options?.requireSquare ?? true;
    const metadata = await sharp(buffer).metadata();

    if (!['png', 'webp'].includes(metadata.format || '')) {
      throw new AppError(400, 'Image must be PNG or WebP format');
    }

    if (requireSquare && metadata.width !== metadata.height) {
      throw new AppError(400, 'Image must be square (equal width and height)');
    }

    let processedBuffer = buffer;
    const needsConversion = metadata.format !== 'webp';
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

      processedBuffer = await sharpInstance.webp({ quality: 90 }).toBuffer();
    }

    const uploadOptions: Record<string, unknown> = {
      folder: `${env.CLOUDINARY_FOLDER}/${folder}`,
      format: 'webp',
      resource_type: 'image',
    };

    if (options?.publicId) {
      uploadOptions.public_id = options.publicId;
      uploadOptions.overwrite = true;
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) reject(new AppError(500, 'Image upload failed'));
        else resolve(result!.secure_url);
      });
      stream.end(processedBuffer);
    });
  }

  async renameImage(imageUrl: string, folder: string, newPublicId: string): Promise<string> {
    if (!imageUrl || !env.CLOUDINARY_CLOUD_NAME) return imageUrl;

    const oldPublicId = extractPublicId(imageUrl);
    if (!oldPublicId) return imageUrl;

    const fullNewPublicId = `${env.CLOUDINARY_FOLDER}/${folder}/${newPublicId}`;
    if (oldPublicId === fullNewPublicId) return imageUrl;

    try {
      const result = await cloudinary.uploader.rename(oldPublicId, fullNewPublicId, {
        overwrite: true,
      });
      return result.secure_url;
    } catch {
      return imageUrl;
    }
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (!imageUrl || !env.CLOUDINARY_CLOUD_NAME) return;

    const publicId = extractPublicId(imageUrl);
    if (!publicId) return;

    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // Best-effort cleanup — don't fail the operation if delete fails
    }
  }
}
