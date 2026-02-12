import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
    name: z.string().min(1),
    imageUrl: z.string().url().optional(),
    productSetId: z.string().optional(),
    productTypeId: z.string().optional(),
    search: z.object({
      phrases: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
      override: z.boolean().optional(),
    }).optional(),
    price: z.object({
      max: z.number().positive(),
      min: z.number().positive().optional(),
    }).optional(),
    disabled: z.boolean().optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    productSetId: z.string().nullable().optional(),
    productTypeId: z.string().nullable().optional(),
    search: z.object({
      phrases: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
      override: z.boolean().optional(),
    }).nullable().optional(),
    price: z.object({
      max: z.number().positive(),
      min: z.number().positive().optional(),
    }).nullable().optional(),
    disabled: z.boolean().optional(),
  }),
});

export const createProductSetSchema = z.object({
  body: z.object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
    name: z.string().min(1),
    series: z.string().min(1),
    imageUrl: z.string().url().optional(),
    releaseDate: z.string().optional(),
  }),
});

export const updateProductSetSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    series: z.string().min(1).optional(),
    imageUrl: z.string().url().optional(),
    releaseDate: z.string().nullable().optional(),
  }),
});

export const createProductTypeSchema = z.object({
  body: z.object({
    id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
    name: z.string().min(1),
    search: z.object({
      phrases: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    }).optional(),
  }),
});

export const updateProductTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    search: z.object({
      phrases: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    }).nullable().optional(),
  }),
});
