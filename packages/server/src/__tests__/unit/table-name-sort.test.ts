import { describe, it, expect } from 'vitest';
import { compareTableNames, sortTablesByName } from '../../lib/table-name-sort.js';

const namesOf = (tables: { name: string }[]): string[] => tables.map((t) => t.name);

describe('compareTableNames', () => {
  it('orders numeric runs by value, not lexicographically', () => {
    const sorted = ['Table 10', 'Table 2', 'Table 1'].sort(compareTableNames);
    expect(sorted).toEqual(['Table 1', 'Table 2', 'Table 10']);
  });

  it('produces the canonical spec ordering from a scrambled input', () => {
    const sorted = ['Table 10', 'Bob', 'Table 3', 'Table 1', 'Table 2'].sort(compareTableNames);
    expect(sorted).toEqual(['Bob', 'Table 1', 'Table 2', 'Table 3', 'Table 10']);
  });

  it('compares alphabetic runs case-insensitively', () => {
    // Case must not drive primary ordering: a raw ASCII compare would put
    // 'Banana' (B=66) before 'apple' (a=97).
    expect(compareTableNames('apple', 'Banana')).toBeLessThan(0);
    expect(compareTableNames('table 2', 'Table 10')).toBeLessThan(0);
  });

  it('sorts purely numeric names before alphabetic names', () => {
    expect(compareTableNames('5', 'Bob')).toBeLessThan(0);

    const sorted = ['Bob', '12', 'Table 1', '5'].sort(compareTableNames);
    expect(sorted).toEqual(['5', '12', 'Bob', 'Table 1']);
  });

  it('sorts a name that is a prefix of another before the longer name', () => {
    expect(['Table 1', 'Table'].sort(compareTableNames)).toEqual(['Table', 'Table 1']);
    // No separator character to diverge on — the shorter run list must win.
    expect(['Table1', 'Table'].sort(compareTableNames)).toEqual(['Table', 'Table1']);
    expect(['Room 2 A', 'Room 2'].sort(compareTableNames)).toEqual(['Room 2', 'Room 2 A']);
  });

  it('sorts an empty name before any non-empty name', () => {
    expect(compareTableNames('', 'Table 1')).toBeLessThan(0);
    expect(compareTableNames('', '')).toBe(0);
  });

  it('orders names with no digits alphabetically', () => {
    const sorted = ['Patio A', 'Bob', 'Bar'].sort(compareTableNames);
    expect(sorted).toEqual(['Bar', 'Bob', 'Patio A']);
  });

  it('breaks residual ties deterministically so the result never depends on input order', () => {
    // Leading zeros compare equal as numbers; case-only differences compare
    // equal as text. Both must still yield a stable, antisymmetric order.
    for (const [a, b] of [
      ['Table 07', 'Table 7'],
      ['PATIO', 'patio'],
    ]) {
      expect(compareTableNames(a, b)).not.toBe(0);
      expect(compareTableNames(a, b)).toBe(-compareTableNames(b, a));
    }

    expect(['Table 7', 'Table 07'].sort(compareTableNames)).toEqual(
      ['Table 07', 'Table 7'].sort(compareTableNames)
    );
  });

  it('returns 0 for identical names', () => {
    expect(compareTableNames('Table 1', 'Table 1')).toBe(0);
  });

  it('orders a mid-name numeric/alphabetic clash deterministically', () => {
    expect(compareTableNames('Room 2A', 'Room A2')).toBeLessThan(0);
  });

  it('stays antisymmetric for digit runs too long for a float', () => {
    // Number() overflows to Infinity past ~309 digits, and Infinity - Infinity
    // is NaN — which would make both directions compare as "greater".
    const small = `Table ${'1'.repeat(400)}`;
    const large = `Table ${'9'.repeat(400)}`;

    expect(compareTableNames(small, large)).toBeLessThan(0);
    expect(compareTableNames(large, small)).toBeGreaterThan(0);
  });

  it('compares long digit runs exactly, without float precision loss', () => {
    // These two numbers are indistinguishable once coerced to a double.
    expect(compareTableNames('Table 12345678901234567890', 'Table 12345678901234567891')).toBeLessThan(0);

    // The numeric run must decide the order even when a later run disagrees.
    expect(
      compareTableNames('Room 12345678901234567890 Zebra', 'Room 12345678901234567891 Apple')
    ).toBeLessThan(0);
  });

  it('orders digit runs by magnitude, not digit count, once leading zeros are stripped', () => {
    expect(compareTableNames('Table 0009', 'Table 10')).toBeLessThan(0);
    expect(compareTableNames('Table 0', 'Table 5')).toBeLessThan(0);
  });

  it('handles multiple numeric runs within one name', () => {
    const sorted = ['Room 2 Table 10', 'Room 2 Table 2', 'Room 10 Table 1'].sort(compareTableNames);
    expect(sorted).toEqual(['Room 2 Table 2', 'Room 2 Table 10', 'Room 10 Table 1']);
  });
});

describe('compareTableNames — comparator contract', () => {
  // A comparator that is not antisymmetric or transitive lets Array.sort()
  // produce implementation-defined garbage, so assert the laws over a fixed
  // corpus of adversarial names rather than one case at a time.
  const corpus = [
    '',
    '0',
    '00',
    '5',
    '12',
    'Bob',
    'bob',
    'BOB',
    'Bar',
    'Patio A',
    'Table',
    'Table1',
    'Table 1',
    'Table 01',
    'Table 2',
    'Table 10',
    'Table 9',
    'Room 2A',
    'Room A2',
    'Room 2 Table 2',
    'Room 10 Table 1',
    `Table ${'1'.repeat(400)}`,
    `Table ${'9'.repeat(400)}`,
    'Table 12345678901234567890',
    'Table 12345678901234567891',
    // toLowerCase() is not length-preserving: '\u0130' lowercases to two code
    // points, and the '\uFB00' ligature does not lowercase to 'ff' at all.
    '\u0130stanbul',
    'istanbul',
    '\uFB00',
    'ff',
    'Caf\u00E9', // composed e-acute
    'Cafe\u0301', // decomposed e + combining acute: same glyph, different string
    '\u0663', // Arabic-Indic digit three: \d does not match it, so it is an alpha run
    '\u{1F37D} Patio', // surrogate pair
  ];

  const sign = (n: number): number => Math.sign(n);

  it('is antisymmetric: cmp(a, b) and cmp(b, a) always have opposing signs', () => {
    for (const a of corpus) {
      for (const b of corpus) {
        // Summing sidesteps Object.is treating -0 and 0 as distinct. NaN, the
        // symptom of an overflowing comparison, fails this too.
        expect(sign(compareTableNames(a, b)) + sign(compareTableNames(b, a))).toBe(0);
      }
    }
  });

  it('is reflexive: cmp(a, a) === 0 for every name', () => {
    for (const a of corpus) {
      expect(compareTableNames(a, a)).toBe(0);
    }
  });

  it('is transitive: a < b and b < c implies a < c', () => {
    for (const a of corpus) {
      for (const b of corpus) {
        for (const c of corpus) {
          if (compareTableNames(a, b) < 0 && compareTableNames(b, c) < 0) {
            expect(compareTableNames(a, c)).toBeLessThan(0);
          }
        }
      }
    }
  });

  it('produces a total order — no two distinct names ever compare equal', () => {
    for (const a of corpus) {
      for (const b of corpus) {
        if (a !== b) expect(compareTableNames(a, b)).not.toBe(0);
      }
    }
  });

  it('sorts to the same result regardless of the input order', () => {
    const forward = [...corpus].sort(compareTableNames);
    const reversed = [...corpus].reverse().sort(compareTableNames);

    expect(reversed).toEqual(forward);
  });
});

describe('sortTablesByName', () => {
  it('sorts table rows by natural name order', () => {
    const tables = [{ name: 'Table 10' }, { name: 'Bob' }, { name: 'Table 2' }, { name: 'Table 1' }];

    expect(namesOf(sortTablesByName(tables))).toEqual(['Bob', 'Table 1', 'Table 2', 'Table 10']);
  });

  it('preserves the other fields on each row', () => {
    const tables = [
      { id: 'b', name: 'Table 2', capacity: 4 },
      { id: 'a', name: 'Table 1', capacity: 2 },
    ];

    expect(sortTablesByName(tables)).toEqual([
      { id: 'a', name: 'Table 1', capacity: 2 },
      { id: 'b', name: 'Table 2', capacity: 4 },
    ]);
  });

  it('does not mutate the input array', () => {
    const tables = [{ name: 'Table 2' }, { name: 'Table 1' }];
    sortTablesByName(tables);
    expect(namesOf(tables)).toEqual(['Table 2', 'Table 1']);
  });

  it('returns an empty array unchanged', () => {
    expect(sortTablesByName([])).toEqual([]);
  });
});
