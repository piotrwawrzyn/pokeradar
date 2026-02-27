import { ProductMatchingPipeline } from '../pipeline';
import { PipelineConfig } from '../types';

// ── Shared test config ──

const CONFIG: PipelineConfig = {
  productTypes: [
    {
      id: 'booster',
      name: 'Booster',
      matchingProfile: { required: ['booster'], forbidden: [] },
      contains: [],
    },
    {
      id: 'booster-box',
      name: 'Booster Box',
      matchingProfile: { required: ['booster', 'box'], forbidden: [] },
      contains: ['booster'],
    },
    {
      id: 'booster-bundle',
      name: 'Booster Bundle',
      matchingProfile: { required: ['booster', 'bundle'], forbidden: [] },
      contains: ['booster'],
    },
    {
      id: 'etb',
      name: 'Elite Trainer Box',
      matchingProfile: { required: ['elite', 'trainer', 'box'], forbidden: [] },
      contains: ['booster'],
    },
    {
      id: 'mini-tin',
      name: 'Mini Tin',
      matchingProfile: { required: ['mini', 'tin'], forbidden: [] },
      contains: ['booster'],
    },
  ],
  productSets: [
    {
      id: 'sv08',
      name: 'Surging Sparks',
      series: 'Scarlet & Violet',
      setNumber: 'SV8',
      setAbbreviation: 'SSP',
    },
    {
      id: 'sv07',
      name: 'Stellar Crown',
      series: 'Scarlet & Violet',
      setNumber: 'SV7',
      setAbbreviation: 'SCR',
    },
    {
      id: 'sv09',
      name: 'Destined Rivals',
      series: 'Scarlet & Violet',
      setNumber: 'SV10',
      setAbbreviation: 'DRI',
    },
    {
      id: 'sv-generic',
      name: 'Scarlet & Violet',
      series: 'Scarlet & Violet',
      setNumber: 'SV1',
      setAbbreviation: 'SVI',
    },
    {
      id: 'xy-me',
      name: 'Mega Evolution',
      series: 'Mega Evolution',
      setNumber: 'ME1',
      setAbbreviation: 'MEG',
    },
    {
      id: 'xy-pf',
      name: 'Phantasmal Flames',
      series: 'Mega Evolution',
      setNumber: 'ME2',
      setAbbreviation: 'PFL',
    },
  ],
};

describe('ProductMatchingPipeline', () => {
  const pipeline = new ProductMatchingPipeline(CONFIG);

  describe('end-to-end matching', () => {
    it('matches a standard title to correct type and set', () => {
      const result = pipeline.match('Surging Sparks Booster Box');
      expect(result).not.toBeNull();
      expect(result!.productType.id).toBe('booster-box');
      expect(result!.productSet.id).toBe('sv08');
    });

    it('matches ETB to correct type and set', () => {
      const result = pipeline.match('Stellar Crown Elite Trainer Box');
      expect(result).not.toBeNull();
      expect(result!.productType.id).toBe('etb');
      expect(result!.productSet.id).toBe('sv07');
    });

    it('matches Booster Bundle', () => {
      const result = pipeline.match('Destined Rivals Booster Bundle');
      expect(result).not.toBeNull();
      expect(result!.productType.id).toBe('booster-bundle');
      expect(result!.productSet.id).toBe('sv09');
    });

    it('matches a standalone booster', () => {
      const result = pipeline.match('Surging Sparks Booster');
      expect(result).not.toBeNull();
      expect(result!.productType.id).toBe('booster');
      expect(result!.productSet.id).toBe('sv08');
    });
  });

  describe('normalization passthrough', () => {
    it('handles Polish characters in title', () => {
      const result = pipeline.match('Pokémon TCG: Surging Sparks Booster Box – edycja PL');
      expect(result).not.toBeNull();
      expect(result!.productType.id).toBe('booster-box');
      expect(result!.productSet.id).toBe('sv08');
    });

    it('handles mixed case and extra whitespace', () => {
      const result = pipeline.match('  SURGING   SPARKS   booster   BOX  ');
      expect(result).not.toBeNull();
      expect(result!.productType.id).toBe('booster-box');
      expect(result!.productSet.id).toBe('sv08');
    });
  });

  describe('early termination', () => {
    it('returns null when title is too short', () => {
      expect(pipeline.match('ab')).toBeNull();
    });

    it('returns null when no type matches', () => {
      expect(pipeline.match('Surging Sparks Random Product')).toBeNull();
    });

    it('returns null when type matches but no set matches', () => {
      expect(pipeline.match('Unknown Set Booster Box')).toBeNull();
    });
  });

  describe('generic set handling', () => {
    it('prefers specific set over generic in same series', () => {
      const result = pipeline.match('Phantasmal Flames Booster Box');
      expect(result).not.toBeNull();
      expect(result!.productSet.id).toBe('xy-pf');
    });

    it('falls back to generic set when appropriate', () => {
      const result = pipeline.match('Mega Evolution Booster Box');
      expect(result).not.toBeNull();
      expect(result!.productSet.id).toBe('xy-me');
    });
  });

  describe('reusability', () => {
    it('handles multiple calls on the same pipeline instance', () => {
      const r1 = pipeline.match('Surging Sparks Booster Box');
      const r2 = pipeline.match('Stellar Crown Elite Trainer Box');
      const r3 = pipeline.match('Destined Rivals Mini Tin');

      expect(r1!.productType.id).toBe('booster-box');
      expect(r1!.productSet.id).toBe('sv08');

      expect(r2!.productType.id).toBe('etb');
      expect(r2!.productSet.id).toBe('sv07');

      expect(r3!.productType.id).toBe('mini-tin');
      expect(r3!.productSet.id).toBe('sv09');
    });
  });

  describe('result structure', () => {
    it('contains all expected fields', () => {
      const result = pipeline.match('Surging Sparks Booster Box');
      expect(result).toHaveProperty('title.raw');
      expect(result).toHaveProperty('title.normalized');
      expect(result).toHaveProperty('productType.id');
      expect(result).toHaveProperty('productType.name');
      expect(result).toHaveProperty('productSet.id');
      expect(result).toHaveProperty('productSet.name');
      expect(result).toHaveProperty('typeMatchScore');
      expect(result).toHaveProperty('setMatchScore');
    });

    it('preserves original raw title', () => {
      const raw = '  Surging Sparks  BOOSTER Box  ';
      const result = pipeline.match(raw);
      expect(result!.title.raw).toBe(raw);
    });
  });
});
