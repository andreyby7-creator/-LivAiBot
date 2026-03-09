import { describe, expect, it } from 'vitest';

import { stableHash } from '../src/hash.js';

describe('hash.ts', () => {
  it('stableHash: детерминированный, возвращает unsigned 32-bit int', () => {
    const inputs = [
      '',
      'a',
      'ab',
      'abc',
      'abcd',
      'abcde',
      'abcdef',
      'abcdefg',
      'user🚀123',
      'tenant-456',
      '192.168.1.1',
    ] as const;

    inputs.forEach((input) => {
      const h1 = stableHash(input);
      const h2 = stableHash(input);

      expect(h1).toBe(h2);
      expect(Number.isInteger(h1)).toBe(true);
      expect(h1).toBeGreaterThanOrEqual(0);
      expect(h1).toBeLessThanOrEqual(0xffff_ffff);
    });
  });

  it('stableHash: разные строки обычно дают разные значения (sanity)', () => {
    const h1 = stableHash('abc');
    const h2 = stableHash('abd');
    expect(h1).not.toBe(h2);
  });
});
