/** Default tax rate (decimal fraction) used when no tax rate is configured. */
export const DEFAULT_TAX_RATE = 0.08;

/**
 * Resolve the configured tax rate as a decimal fraction (e.g. 0.08 for 8%).
 *
 * `taxRate` is stored inside the `orderSettings` JSON blob as a percentage
 * (0–100, as entered in the admin "Tax Rate (%)" field). This normalizes it to
 * a decimal multiplier and falls back to {@link DEFAULT_TAX_RATE} when unset or
 * invalid. A configured value of 0 (e.g. GST-inclusive pricing) is respected.
 */
export function resolveTaxRate(orderSettings: unknown): number {
  const raw = (orderSettings as Record<string, unknown> | null | undefined)?.taxRate;
  return typeof raw === 'number' && raw >= 0 ? raw / 100 : DEFAULT_TAX_RATE;
}
