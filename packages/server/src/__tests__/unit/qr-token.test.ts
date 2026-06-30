import { describe, it, expect } from 'vitest';
import { generateQrToken, tableQrUrl } from '../../lib/qr.js';

describe('generateQrToken', () => {
  it('produces a URL-safe token (base64url alphabet only)', () => {
    const token = generateQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a token long enough to be unguessable (>= 22 chars)', () => {
    expect(generateQrToken().length).toBeGreaterThanOrEqual(22);
  });

  it('produces a different token on each call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateQrToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('tableQrUrl', () => {
  it('composes the storefront /t/<token> URL from PUBLIC_URL', () => {
    const prev = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = 'https://shop.example.com';
    expect(tableQrUrl('abc123')).toBe('https://shop.example.com/t/abc123');
    process.env.PUBLIC_URL = prev;
  });

  it('does not emit a double slash when PUBLIC_URL has a trailing slash', () => {
    const prev = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = 'https://shop.example.com/';
    expect(tableQrUrl('abc123')).toBe('https://shop.example.com/t/abc123');
    process.env.PUBLIC_URL = prev;
  });
});
