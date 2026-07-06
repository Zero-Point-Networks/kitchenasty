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
