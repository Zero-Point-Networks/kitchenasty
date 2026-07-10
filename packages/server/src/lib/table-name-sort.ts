// Natural ordering for table names, so 'Table 2' precedes 'Table 10' rather
// than sorting lexicographically. Prisma cannot express this in an orderBy, so
// callers sort the fetched rows in memory.

const DIGIT_RUN = /(\d+)/;
const ONLY_DIGITS = /^\d+$/;
const LEADING_ZEROS = /^0+/;

function tokenize(name: string): string[] {
  return name.split(DIGIT_RUN).filter((run) => run !== '');
}

function isNumeric(run: string): boolean {
  return ONLY_DIGITS.test(run);
}

function compareAscii(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Digit runs are compared as strings rather than via Number(): a table name may
// carry more digits than a float can hold, where Number() would lose precision
// and, past ~309 digits, overflow to Infinity — making Infinity - Infinity NaN
// and breaking the antisymmetry Array.prototype.sort requires. Once leading
// zeros are gone, the longer run is the larger number, and equal-length runs
// compare lexicographically exactly as they compare numerically.
function compareDigitRuns(a: string, b: string): number {
  const aDigits = a.replace(LEADING_ZEROS, '');
  const bDigits = b.replace(LEADING_ZEROS, '');

  if (aDigits.length !== bDigits.length) return aDigits.length < bDigits.length ? -1 : 1;
  return compareAscii(aDigits, bDigits);
}

/**
 * Compares two table names in natural order. Numeric runs compare as numbers,
 * alphabetic runs compare case-insensitively, and a numeric run sorts before an
 * alphabetic one (so '5' precedes 'Bob'). Names that tie on every run fall back
 * to a raw comparison, which keeps the result independent of input order.
 */
export function compareTableNames(a: string, b: string): number {
  const aRuns = tokenize(a);
  const bRuns = tokenize(b);

  for (let i = 0; i < Math.min(aRuns.length, bRuns.length); i++) {
    const aRun = aRuns[i];
    const bRun = bRuns[i];
    const aIsNumeric = isNumeric(aRun);
    const bIsNumeric = isNumeric(bRun);

    if (aIsNumeric !== bIsNumeric) return aIsNumeric ? -1 : 1;

    const order = aIsNumeric
      ? compareDigitRuns(aRun, bRun)
      : compareAscii(aRun.toLowerCase(), bRun.toLowerCase());

    if (order !== 0) return order;
  }

  if (aRuns.length !== bRuns.length) return aRuns.length < bRuns.length ? -1 : 1;

  return compareAscii(a, b);
}

/** Returns a new array of tables ordered by {@link compareTableNames}. */
export function sortTablesByName<T extends { name: string }>(tables: T[]): T[] {
  return [...tables].sort((a, b) => compareTableNames(a.name, b.name));
}
