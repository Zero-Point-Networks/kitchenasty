import { randomBytes } from 'crypto';

/** Fallback storefront origin used when PUBLIC_URL is unset. */
export const DEFAULT_PUBLIC_URL = 'https://inka.kitchenasty.com';

/**
 * Generates an opaque, URL-safe token for a table's dine-in QR code.
 * 18 random bytes → 24 base64url chars: unguessable and safe to rotate
 * without touching the table's primary key.
 */
export function generateQrToken(): string {
  return randomBytes(18).toString('base64url');
}

/** Composes the public storefront URL a dine-in QR code points at. */
export function tableQrUrl(token: string): string {
  const base = (process.env.PUBLIC_URL || DEFAULT_PUBLIC_URL).replace(/\/+$/, '');
  return `${base}/t/${token}`;
}
