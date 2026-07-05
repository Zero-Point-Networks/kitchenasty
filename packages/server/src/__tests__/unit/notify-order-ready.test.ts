import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/db.js', () => {
  const mockPrisma = {
    siteSettings: { findUnique: vi.fn() },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

vi.mock('../../lib/email.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/email.js')>();
  return { ...actual, sendEmail: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('../../lib/sms.js', () => ({
  sendSMS: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/socket.js', () => ({
  sendExpoPush: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '../../lib/db.js';
import { sendEmail } from '../../lib/email.js';
import { sendSMS } from '../../lib/sms.js';
import { sendExpoPush } from '../../lib/socket.js';
import { notifyOrderReady } from '../../lib/notifications.js';

const mockedPrisma = vi.mocked(prisma);
const mockedSendEmail = vi.mocked(sendEmail);
const mockedSendSMS = vi.mocked(sendSMS);
const mockedSendExpoPush = vi.mocked(sendExpoPush);

function mockSettings(notificationSettings: Record<string, boolean> | null = null, siteName = 'KitchenAsty') {
  (mockedPrisma.siteSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'default',
    siteName,
    notificationSettings,
  });
}

const guestOrder = {
  orderNumber: 'KA-100',
  customer: null,
  guestEmail: 'guest@test.com',
  guestPhone: '+61400000000',
  table: null,
};

const customerOrder = {
  orderNumber: 'KA-200',
  customer: { email: 'cust@test.com', phone: '+61411111111', expoPushToken: 'ExponentPushToken[abc]' },
  guestEmail: 'guest@test.com',
  guestPhone: '+61400000000',
  table: null,
};

describe('notifyOrderReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings();
  });

  describe('email channel', () => {
    it('emails the guest with the ready template by default', async () => {
      await notifyOrderReady(guestOrder);
      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      const arg = mockedSendEmail.mock.calls[0][0];
      expect(arg.to).toBe('guest@test.com');
      expect(arg.subject).toContain('ready for collection');
      expect(arg.subject).toContain('KA-100');
    });

    it('prefers the customer email over the guest email', async () => {
      await notifyOrderReady(customerOrder);
      expect(mockedSendEmail.mock.calls[0][0].to).toBe('cust@test.com');
    });

    it('does not email when readyEmailEnabled is false', async () => {
      mockSettings({ readyEmailEnabled: false });
      await notifyOrderReady(guestOrder);
      expect(mockedSendEmail).not.toHaveBeenCalled();
    });

    it('includes the table label in the email when present', async () => {
      await notifyOrderReady({ ...guestOrder, table: { name: 'Table 4' } });
      expect(mockedSendEmail.mock.calls[0][0].html).toContain('Table 4');
    });
  });

  describe('sms channel', () => {
    it('does not SMS by default even when a phone is present', async () => {
      await notifyOrderReady(guestOrder);
      expect(mockedSendSMS).not.toHaveBeenCalled();
    });

    it('sends an SMS when readySmsEnabled and a phone is present', async () => {
      mockSettings({ readySmsEnabled: true });
      await notifyOrderReady(guestOrder);
      expect(mockedSendSMS).toHaveBeenCalledTimes(1);
      const [to, body] = mockedSendSMS.mock.calls[0];
      expect(to).toBe('+61400000000');
      expect(body).toContain('KitchenAsty');
      expect(body).toContain('KA-100');
      expect(body.toLowerCase()).toContain('ready for pickup');
    });

    it('includes the table label in the SMS when present', async () => {
      mockSettings({ readySmsEnabled: true });
      await notifyOrderReady({ ...guestOrder, table: { name: 'Room 12' } });
      expect(mockedSendSMS.mock.calls[0][1]).toContain('Room 12');
    });

    it('does not SMS when enabled but no phone exists', async () => {
      mockSettings({ readySmsEnabled: true });
      await notifyOrderReady({ ...guestOrder, guestPhone: null });
      expect(mockedSendSMS).not.toHaveBeenCalled();
    });
  });

  describe('push channel', () => {
    it('pushes to the customer token by default', async () => {
      await notifyOrderReady(customerOrder);
      expect(mockedSendExpoPush).toHaveBeenCalledTimes(1);
      const [token, title, body] = mockedSendExpoPush.mock.calls[0];
      expect(token).toBe('ExponentPushToken[abc]');
      expect(title).toContain('KA-200');
      expect(body.toLowerCase()).toContain('ready');
    });

    it('does not push when readyPushEnabled is false', async () => {
      mockSettings({ readyPushEnabled: false });
      await notifyOrderReady(customerOrder);
      expect(mockedSendExpoPush).not.toHaveBeenCalled();
    });

    it('does not push for guest orders with no token', async () => {
      await notifyOrderReady(guestOrder);
      expect(mockedSendExpoPush).not.toHaveBeenCalled();
    });
  });

  describe('resilience', () => {
    it('no-ops without throwing when the order has no contact details', async () => {
      await expect(
        notifyOrderReady({ orderNumber: 'KA-300', customer: null, guestEmail: null, guestPhone: null, table: null }),
      ).resolves.toBeUndefined();
      expect(mockedSendEmail).not.toHaveBeenCalled();
      expect(mockedSendSMS).not.toHaveBeenCalled();
      expect(mockedSendExpoPush).not.toHaveBeenCalled();
    });

    it('still sends the other channels when one channel fails', async () => {
      mockSettings({ readySmsEnabled: true });
      mockedSendEmail.mockRejectedValueOnce(new Error('smtp down'));
      await expect(notifyOrderReady(customerOrder)).resolves.toBeUndefined();
      expect(mockedSendSMS).toHaveBeenCalledTimes(1);
      expect(mockedSendExpoPush).toHaveBeenCalledTimes(1);
    });

    it('falls back to default toggles when the settings read fails', async () => {
      (mockedPrisma.siteSettings.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));
      await notifyOrderReady(guestOrder);
      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      expect(mockedSendSMS).not.toHaveBeenCalled();
    });
  });
});
