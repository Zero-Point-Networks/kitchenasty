import { randomBytes } from 'crypto';

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
  const base = (process.env.PUBLIC_URL || 'https://inka.kitchenasty.com').replace(/\/+$/, '');
  return `${base}/t/${token}`;
}
