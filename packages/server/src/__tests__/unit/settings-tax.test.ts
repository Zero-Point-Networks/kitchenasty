import { describe, it, expect } from 'vitest';
import { resolveTaxRate, DEFAULT_TAX_RATE } from '../../lib/settings.js';

describe('resolveTaxRate', () => {
  it('normalizes a stored percentage to a decimal fraction', () => {
    expect(resolveTaxRate({ taxRate: 8 })).toBeCloseTo(0.08);
    expect(resolveTaxRate({ taxRate: 8.25 })).toBeCloseTo(0.0825);
    expect(resolveTaxRate({ taxRate: 100 })).toBe(1);
  });

  it('respects a configured rate of 0 (e.g. GST-inclusive pricing)', () => {
    expect(resolveTaxRate({ taxRate: 0 })).toBe(0);
  });

  it('falls back to the default when taxRate is missing', () => {
    expect(resolveTaxRate({})).toBe(DEFAULT_TAX_RATE);
    expect(resolveTaxRate({ enabled: true })).toBe(DEFAULT_TAX_RATE);
  });

  it('falls back to the default for null/undefined orderSettings', () => {
    expect(resolveTaxRate(null)).toBe(DEFAULT_TAX_RATE);
    expect(resolveTaxRate(undefined)).toBe(DEFAULT_TAX_RATE);
  });

  it('falls back to the default for invalid (non-numeric or negative) values', () => {
    expect(resolveTaxRate({ taxRate: 'nope' })).toBe(DEFAULT_TAX_RATE);
    expect(resolveTaxRate({ taxRate: -5 })).toBe(DEFAULT_TAX_RATE);
    expect(resolveTaxRate({ taxRate: null })).toBe(DEFAULT_TAX_RATE);
  });
});
