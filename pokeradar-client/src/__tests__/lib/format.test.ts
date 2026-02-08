import { describe, it, expect } from 'vitest';
import { formatPLN, formatDate } from '@/lib/format';

describe('formatPLN', () => {
  it('formats a positive number as PLN currency', () => {
    const result = formatPLN(179.99);
    // Polish locale uses non-breaking space and "zł"
    expect(result).toContain('179');
    expect(result).toContain('99');
    expect(result).toMatch(/zł|PLN/);
  });

  it('formats zero correctly', () => {
    const result = formatPLN(0);
    expect(result).toContain('0');
  });

  it('returns em dash for null', () => {
    expect(formatPLN(null)).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string in Polish locale', () => {
    const result = formatDate('2024-01-15T00:00:00Z');
    // Should contain year and Polish month name
    expect(result).toContain('2024');
    expect(result).toMatch(/stycz/i);
  });

  it('returns em dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns em dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});
