import { z } from 'zod';

export const addWatchEntrySchema = z.object({
  body: z.object({
    productId: z.string().min(1),
    maxPrice: z.number().positive(),
  }),
});

export const updateWatchEntrySchema = z.object({
  body: z.object({
    maxPrice: z.number().positive(),
  }),
});
