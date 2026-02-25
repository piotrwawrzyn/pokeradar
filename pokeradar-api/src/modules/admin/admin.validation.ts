import { z } from 'zod';

const searchOverrideSchema = z.object({
  additionalRequired: z.array(z.string().trim()).optional(),
  additionalForbidden: z.array(z.string().trim()).optional(),
  customPhrase: z.string().trim().optional(),
});

export const createProductSchema = z.object({
  body: z.object({
    id: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
    name: z.string().trim().min(1),
    imageUrl: z.string().trim().url().optional(),
    productSetId: z.string().trim().optional(),
    productTypeId: z.string().trim().optional(),
    searchOverride: searchOverrideSchema.optional(),
    price: z
      .object({
        max: z.number().positive(),
        min: z.number().positive().optional(),
      })
      .optional(),
    disabled: z.boolean().optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().url().optional(),
    productSetId: z.string().trim().nullable().optional(),
    productTypeId: z.string().trim().nullable().optional(),
    searchOverride: searchOverrideSchema.nullable().optional(),
    price: z
      .object({
        max: z.number().positive(),
        min: z.number().positive().optional(),
      })
      .nullable()
      .optional(),
    disabled: z.boolean().optional(),
  }),
});

export const createProductSetSchema = z.object({
  body: z.object({
    id: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
    name: z.string().trim().min(1),
    series: z.string().trim().min(1),
    imageUrl: z.string().trim().url().optional(),
    releaseDate: z.string().trim().optional(),
  }),
});

export const updateProductSetSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).optional(),
    series: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().url().optional(),
    releaseDate: z.string().trim().nullable().optional(),
  }),
});

const matchingProfileSchema = z.object({
  required: z.array(z.string().trim()).default([]),
  forbidden: z.array(z.string().trim()).default([]),
  synonyms: z.record(z.string()).optional(),
});

export const createProductTypeSchema = z.object({
  body: z.object({
    id: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
    name: z.string().trim().min(1),
    matchingProfile: matchingProfileSchema.optional(),
  }),
});

export const updateProductTypeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).optional(),
    matchingProfile: matchingProfileSchema.nullable().optional(),
  }),
});
