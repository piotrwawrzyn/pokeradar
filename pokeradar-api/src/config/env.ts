import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLIENT_DOMAIN: z.string().default('localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('pokeradar-dev'),
});

const parsedEnv = envSchema.parse(process.env);

// Construct URLs from CLIENT_DOMAIN
const isLocalhost = parsedEnv.CLIENT_DOMAIN.includes('localhost');
const protocol = isLocalhost ? 'http' : 'https';
const frontendUrl = `${protocol}://${parsedEnv.CLIENT_DOMAIN}`;

const allowedOrigins = [frontendUrl];

export const env = {
  ...parsedEnv,
  FRONTEND_URL: frontendUrl,
  ALLOWED_ORIGINS: allowedOrigins,
};
