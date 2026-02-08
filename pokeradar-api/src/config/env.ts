import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().url('GOOGLE_CALLBACK_URL must be a valid URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_DOMAIN: z.string().default('localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

const parsedEnv = envSchema.parse(process.env);

// Construct URLs from CLIENT_DOMAIN
const isLocalhost = parsedEnv.CLIENT_DOMAIN.includes('localhost');
const protocol = isLocalhost ? 'http' : 'https';
const frontendUrl = `${protocol}://${parsedEnv.CLIENT_DOMAIN}`;

// For CORS, allow both www and non-www versions in production
const allowedOrigins = isLocalhost
  ? [frontendUrl]
  : [
      `https://www.${parsedEnv.CLIENT_DOMAIN}`,
      `https://${parsedEnv.CLIENT_DOMAIN}`,
    ];

export const env = {
  ...parsedEnv,
  FRONTEND_URL: frontendUrl,
  ALLOWED_ORIGINS: allowedOrigins,
};
