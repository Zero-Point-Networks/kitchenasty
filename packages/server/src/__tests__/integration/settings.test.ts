import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { generateToken } from '../../middleware/auth.js';

vi.mock('../../lib/db.js', () => {
  const mockPrisma = {
    siteSettings: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

import prisma from '../../lib/db.js';

const mockedPrisma = vi.mocked(prisma);
const app = createApp();

const adminToken = generateToken({ id: '1', email: 'admin@test.com', type: 'staff', role: 'SUPER_ADMIN' });
const managerToken = generateToken({ id: '2', email: 'manager@test.com', type: 'staff', role: 'MANAGER' });
const staffToken = generateToken({ id: '3', email: 'staff@test.com', type: 'staff', role: 'STAFF' });
const customerToken = generateToken({ id: 'cust-1', email: 'customer@test.com', type: 'customer' });

const settingsRecord = {
  id: 'default',
  siteName: 'KitchenAsty',
  notificationSettings: {
    readyEmailEnabled: false,
    readySmsEnabled: false,
    readyPushEnabled: true,
  },
};

describe('Settings API - plain group (review) characterization', () => {
  const storedReview = { enabled: true, requireOrder: true, autoApprove: false, minimumRating: 3 };

  beforeEach(() => {
    vi.resetAllMocks();
    mockedPrisma.siteSettings.findUnique.mockResolvedValue({ id: 'default', reviewSettings: storedReview } as any);
  });

  it('GET returns the stored group for managers', async () => {
    const res = await request(app)
      .get('/api/settings/review')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(storedReview);
  });

  it('PUT replaces the whole group — omitted keys are dropped, not merged', async () => {
    mockedPrisma.siteSettings.update.mockResolvedValue({ id: 'default', reviewSettings: { enabled: false } } as any);

    const res = await request(app)
      .put('/api/settings/review')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(mockedPrisma.siteSettings.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { reviewSettings: { enabled: false } },
    });
    expect(res.body.data).toEqual({ enabled: false });
  });

  it('PUT rejects an invalid body with 400, the Zod issue array, and writes nothing', async () => {
    const res = await request(app)
      .put('/api/settings/review')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ minimumRating: 9 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.error)).toBe(true);
    expect(mockedPrisma.siteSettings.update).not.toHaveBeenCalled();
  });
});

describe('Settings API - masked group (mail) characterization', () => {
  const storedMail = {
    smtpHost: 'smtp.example.com',
    smtpUser: 'mailer',
    smtpPass: 'supersecretpass',
    senderName: 'KitchenAsty',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockedPrisma.siteSettings.findUnique.mockResolvedValue({ id: 'default', mailSettings: storedMail } as any);
  });

  it('rejects MANAGER access (SUPER_ADMIN only)', async () => {
    const res = await request(app)
      .get('/api/settings/mail')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it('GET masks the SMTP password as first4...last4', async () => {
    const res = await request(app)
      .get('/api/settings/mail')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.smtpPass).toBe('supe...pass');
    expect(res.body.data.smtpHost).toBe('smtp.example.com');
  });

  it('PUT with a masked password preserves the stored secret', async () => {
    mockedPrisma.siteSettings.update.mockImplementation((async (args: any) => ({
      id: 'default',
      mailSettings: args.data.mailSettings,
    })) as any);

    const res = await request(app)
      .put('/api/settings/mail')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ smtpHost: 'smtp.new.com', smtpPass: 'supe...pass' });

    expect(res.status).toBe(200);
    expect(mockedPrisma.siteSettings.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { mailSettings: { smtpHost: 'smtp.new.com', smtpPass: 'supersecretpass' } },
    });
    expect(res.body.data.smtpPass).toBe('supe...pass');
  });

  it('PUT with a fresh password stores it and masks it in the response', async () => {
    mockedPrisma.siteSettings.update.mockImplementation((async (args: any) => ({
      id: 'default',
      mailSettings: args.data.mailSettings,
    })) as any);

    const res = await request(app)
      .put('/api/settings/mail')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ smtpPass: 'brandnewsecret1' });

    expect(mockedPrisma.siteSettings.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { mailSettings: { smtpPass: 'brandnewsecret1' } },
    });
    expect(res.body.data.smtpPass).toBe('bran...ret1');
  });

  it('PUT omitting the secret drops it from storage (current behaviour, characterized)', async () => {
    mockedPrisma.siteSettings.update.mockImplementation((async (args: any) => ({
      id: 'default',
      mailSettings: args.data.mailSettings,
    })) as any);

    const res = await request(app)
      .put('/api/settings/mail')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ smtpHost: 'smtp.new.com' });

    expect(res.status).toBe(200);
    expect(mockedPrisma.siteSettings.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { mailSettings: { smtpHost: 'smtp.new.com' } },
    });
    expect(res.body.data.smtpPass).toBe('');
  });

  it('PUT rejects an invalid body with 400 and writes nothing', async () => {
    const res = await request(app)
      .put('/api/settings/mail')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ senderEmail: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.error)).toBe(true);
    expect(mockedPrisma.siteSettings.update).not.toHaveBeenCalled();
  });
});

describe('Settings API - masked group (payment) characterization', () => {
  const storedPayment = {
    stripeEnabled: true,
    stripeSecretKey: 'sk_live_abcdef123456',
    stripeWebhookSecret: 'whsec_9876543210ab',
    paypalClientSecret: 'pp_secret_zyxwvu99',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockedPrisma.siteSettings.findUnique.mockResolvedValue({ id: 'default', paymentSettings: storedPayment } as any);
  });

  it('rejects MANAGER access (SUPER_ADMIN only)', async () => {
    const res = await request(app)
      .get('/api/settings/payment')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it('PUT rejects an invalid body with 400 and writes nothing', async () => {
    const res = await request(app)
      .put('/api/settings/payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stripeEnabled: 'yes' });

    expect(res.status).toBe(400);
    expect(mockedPrisma.siteSettings.update).not.toHaveBeenCalled();
  });

  it('GET masks all three secrets', async () => {
    const res = await request(app)
      .get('/api/settings/payment')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stripeSecretKey).toBe('sk_l...3456');
    expect(res.body.data.stripeWebhookSecret).toBe('whse...10ab');
    expect(res.body.data.paypalClientSecret).toBe('pp_s...vu99');
    expect(res.body.data.stripeEnabled).toBe(true);
  });

  it('PUT preserves masked secrets and stores fresh ones in the same request', async () => {
    mockedPrisma.siteSettings.update.mockImplementation((async (args: any) => ({
      id: 'default',
      paymentSettings: args.data.paymentSettings,
    })) as any);

    const res = await request(app)
      .put('/api/settings/payment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        stripeSecretKey: 'sk_l...3456',
        stripeWebhookSecret: 'whsec_freshvalue99',
        paypalClientSecret: 'pp_s...wu99',
      });

    expect(res.status).toBe(200);
    expect(mockedPrisma.siteSettings.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: {
        paymentSettings: {
          stripeSecretKey: 'sk_live_abcdef123456',
          stripeWebhookSecret: 'whsec_freshvalue99',
          paypalClientSecret: 'pp_secret_zyxwvu99',
        },
      },
    });
    expect(res.body.data.stripeWebhookSecret).toBe('whse...ue99');
  });
});

describe('Settings API - Notification Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/settings/notifications', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/settings/notifications');
      expect(res.status).toBe(401);
    });

    it('rejects customer and staff access', async () => {
      const customerRes = await request(app)
        .get('/api/settings/notifications')
        .set('Authorization', `Bearer ${customerToken}`);
      const staffRes = await request(app)
        .get('/api/settings/notifications')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(customerRes.status).toBe(403);
      expect(staffRes.status).toBe(403);
    });

    it('returns stored notification settings for managers', async () => {
      mockedPrisma.siteSettings.findUnique.mockResolvedValue(settingsRecord as any);

      const res = await request(app)
        .get('/api/settings/notifications')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(settingsRecord.notificationSettings);
    });
  });

  describe('PUT /api/settings/notifications', () => {
    it('rejects invalid toggle values', async () => {
      const res = await request(app)
        .put('/api/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ readySmsEnabled: 'yes' });

      expect(res.status).toBe(400);
      expect(mockedPrisma.siteSettings.update).not.toHaveBeenCalled();
    });

    it('merges partial updates over the stored notification group', async () => {
      const updatedSettings = {
        ...settingsRecord,
        notificationSettings: {
          ...settingsRecord.notificationSettings,
          readySmsEnabled: true,
        },
      };
      mockedPrisma.siteSettings.findUnique.mockResolvedValue(settingsRecord as any);
      mockedPrisma.siteSettings.update.mockResolvedValue(updatedSettings as any);

      const res = await request(app)
        .put('/api/settings/notifications')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ readySmsEnabled: true });

      expect(res.status).toBe(200);
      expect(mockedPrisma.siteSettings.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: {
          notificationSettings: {
            readyEmailEnabled: false,
            readySmsEnabled: true,
            readyPushEnabled: true,
          },
        },
      });
      expect(res.body.data).toEqual(updatedSettings.notificationSettings);
    });
  });
});
