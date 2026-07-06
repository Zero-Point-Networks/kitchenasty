import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { generateToken } from '../../middleware/auth.js';

vi.mock('../../lib/db.js', () => {
  const mockPrisma = {
    location: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    order: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    orderItem: { count: vi.fn() },
    menuItem: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    deliveryZone: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    table: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    reservation: { count: vi.fn() },
    user: { findUnique: vi.fn() },
    customer: { findUnique: vi.fn(), update: vi.fn() },
    loyaltyTransaction: { create: vi.fn() },
    automationRule: { findMany: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
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
  emitNewOrder: vi.fn(),
  emitOrderStatusUpdate: vi.fn(),
  sendExpoPush: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '../../lib/db.js';
import { sendEmail } from '../../lib/email.js';
import { sendSMS } from '../../lib/sms.js';
import { emitOrderStatusUpdate, sendExpoPush } from '../../lib/socket.js';
import { appEvents } from '../../lib/events.js';

const mockedPrisma = vi.mocked(prisma);
const mockedSendEmail = vi.mocked(sendEmail);
const mockedSendSMS = vi.mocked(sendSMS);
const mockedEmitStatus = vi.mocked(emitOrderStatusUpdate);
const mockedSendExpoPush = vi.mocked(sendExpoPush);

const app = createApp();

const adminToken = generateToken({ id: '1', email: 'admin@test.com', type: 'staff', role: 'SUPER_ADMIN' });
const staffToken = generateToken({ id: '3', email: 'staff@test.com', type: 'staff', role: 'STAFF' });
const customerToken = generateToken({ id: 'cust-1', email: 'customer@test.com', type: 'customer' });

const sampleLocation = { id: 'loc-1', name: 'Downtown Kitchen', isActive: true, isBusy: false, busyMessage: null, operatingHours: [] };
const sampleMenuItem = {
  id: 'item-1',
  name: 'Margherita Pizza',
  price: 14.99,
  isActive: true,
  trackStock: false,
  stockQty: 0,
  options: [],
};
const sampleMenuItemWithStock = {
  ...sampleMenuItem,
  id: 'item-2',
  name: 'Special Pizza',
  trackStock: true,
  stockQty: 5,
};

const validOrderBody = {
  orderType: 'PICKUP',
  items: [{ menuItemId: 'item-1', quantity: 2 }],
  guestName: 'Test Guest',
  guestEmail: 'guest@test.com',
};

const sampleOrder = {
  id: 'order-1',
  orderNumber: 'KA-ABC-123',
  customerId: null,
  locationId: 'loc-1',
  orderType: 'PICKUP',
  status: 'PENDING',
  subtotal: 29.98,
  tax: 2.40,
  deliveryFee: 0,
  total: 32.38,
  items: [],
  createdAt: new Date(),
};

describe('Order API - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // CREATE
  // ============================================================
  describe('POST /api/orders', () => {
    it('creates a pickup order as guest', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.order.create.mockResolvedValue(sampleOrder as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      const res = await request(app).post('/api/orders').send(validOrderBody);

      expect(res.status).toBe(201);
      expect(res.body.data.orderNumber).toBe('KA-ABC-123');
    });

    it('creates an order as authenticated customer', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.order.create.mockResolvedValue({ ...sampleOrder, customerId: 'cust-1', customer: { email: 'customer@test.com' } } as any);
      mockedPrisma.customer.update.mockResolvedValue({ id: 'cust-1', loyaltyPoints: 14 } as any);
      mockedPrisma.loyaltyTransaction.create.mockResolvedValue({} as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ orderType: 'PICKUP', items: [{ menuItemId: 'item-1', quantity: 2 }] });

      expect(res.status).toBe(201);
    });

    it('requires at least one item', async () => {
      const res = await request(app).post('/api/orders').send({
        orderType: 'PICKUP',
        items: [],
      });

      expect(res.status).toBe(400);
    });

    it('validates order type', async () => {
      const res = await request(app).post('/api/orders').send({
        orderType: 'INVALID',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      });

      expect(res.status).toBe(400);
    });

    it('requires address for delivery orders', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);

      const res = await request(app).post('/api/orders').send({
        orderType: 'DELIVERY',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('address');
    });

    it('returns 400 for non-existent menu item', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([]);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);

      const res = await request(app).post('/api/orders').send(validOrderBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not found');
    });

    it('returns 400 for inactive menu item', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([{ ...sampleMenuItem, isActive: false }] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);

      const res = await request(app).post('/api/orders').send(validOrderBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not available');
    });

    it('returns 400 when insufficient stock', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([{ ...sampleMenuItemWithStock, stockQty: 1 }] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);

      const res = await request(app).post('/api/orders').send({
        orderType: 'PICKUP',
        items: [{ menuItemId: 'item-2', quantity: 5 }],
        guestName: 'Test Guest',
        guestEmail: 'guest@test.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('stock');
    });

    it('returns 400 when no active location', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(null);

      const res = await request(app).post('/api/orders').send(validOrderBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('location');
    });

    it('creates delivery order with address', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.deliveryZone.findFirst.mockResolvedValue(null);
      mockedPrisma.order.create.mockResolvedValue({ ...sampleOrder, orderType: 'DELIVERY' } as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      const res = await request(app).post('/api/orders').send({
        orderType: 'DELIVERY',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
        address: { line1: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
        guestName: 'Test Guest',
        guestEmail: 'guest@test.com',
      });

      expect(res.status).toBe(201);
    });
  });

  // ============================================================
  // LIST
  // ============================================================
  describe('GET /api/orders', () => {
    it('requires staff authentication', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(401);
    });

    it('rejects customer access', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns orders for staff', async () => {
      mockedPrisma.order.findMany.mockResolvedValue([sampleOrder] as any);
      mockedPrisma.order.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });
  });

  // ============================================================
  // GET
  // ============================================================
  describe('GET /api/orders/:id', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/orders/order-1');
      expect(res.status).toBe(401);
    });

    it('returns order detail', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue({
        ...sampleOrder,
        items: [{ id: 'oi-1', name: 'Pizza', quantity: 2, unitPrice: 14.99, subtotal: 29.98, options: [] }],
      } as any);

      const res = await request(app)
        .get('/api/orders/order-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.orderNumber).toBe('KA-ABC-123');
    });

    it('returns 404 for unknown order', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/orders/unknown')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // UPDATE STATUS
  // ============================================================
  describe('PATCH /api/orders/:id/status', () => {
    it('requires staff authentication', async () => {
      const res = await request(app)
        .patch('/api/orders/order-1/status')
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(401);
    });

    it('updates order status', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue({ ...sampleOrder, customer: null } as any);
      mockedPrisma.order.update.mockResolvedValue({ ...sampleOrder, status: 'CONFIRMED' } as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      const res = await request(app)
        .patch('/api/orders/order-1/status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('rejects invalid status', async () => {
      const res = await request(app)
        .patch('/api/orders/order-1/status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown order', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/orders/unknown/status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // READY FAN-OUT (order-ready notifications)
  // ============================================================
  describe('PATCH /api/orders/:id/status - READY fan-out', () => {
    const readyPickupOrder = {
      ...sampleOrder,
      status: 'READY',
      orderType: 'PICKUP',
      guestEmail: 'guest@test.com',
      guestPhone: '+61400000000',
      customer: null,
      table: null,
    };

    function patchStatus(status: string) {
      return request(app)
        .patch('/api/orders/order-1/status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status });
    }

    // notifyOrderReady is fire-and-forget; let its promise chain settle
    const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
      mockedPrisma.order.findUnique.mockResolvedValue({ ...sampleOrder, customer: null, guestEmail: 'guest@test.com' } as any);
      mockedPrisma.order.update.mockResolvedValue(readyPickupOrder as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);
      mockedPrisma.siteSettings.findUnique.mockResolvedValue({ siteName: 'KitchenAsty', notificationSettings: null } as any);
    });

    it('sends exactly one email — the dedicated ready template — for READY on a pickup order', async () => {
      const res = await patchStatus('READY');
      expect(res.status).toBe(200);
      await flushAsync();

      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      const arg = mockedSendEmail.mock.calls[0][0];
      expect(arg.to).toBe('guest@test.com');
      expect(arg.subject).toContain('ready for collection');
    });

    it('suppresses the generic push for READY on a collectable order', async () => {
      await patchStatus('READY');
      await flushAsync();

      expect(mockedEmitStatus).toHaveBeenCalledTimes(1);
      expect(mockedEmitStatus.mock.calls[0][1]).toEqual({ suppressPush: true });
    });

    it('sends an SMS with the table label when readySmsEnabled and a phone is present', async () => {
      mockedPrisma.siteSettings.findUnique.mockResolvedValue({
        siteName: 'KitchenAsty',
        notificationSettings: { readySmsEnabled: true },
      } as any);
      mockedPrisma.order.update.mockResolvedValue({
        ...readyPickupOrder,
        orderType: 'DINE_IN',
        table: { name: 'Table 4' },
      } as any);

      await patchStatus('READY');
      await flushAsync();

      expect(mockedSendSMS).toHaveBeenCalledTimes(1);
      const [to, body] = mockedSendSMS.mock.calls[0];
      expect(to).toBe('+61400000000');
      expect(body).toContain('KA-ABC-123');
      expect(body).toContain('Table 4');
    });

    it('pushes the ready message to app customers via the fan-out', async () => {
      mockedPrisma.order.update.mockResolvedValue({
        ...readyPickupOrder,
        guestEmail: null,
        guestPhone: null,
        customer: { email: 'cust@test.com', phone: null, expoPushToken: 'ExponentPushToken[abc]' },
      } as any);

      await patchStatus('READY');
      await flushAsync();

      expect(mockedSendExpoPush).toHaveBeenCalledTimes(1);
      const [token, , body] = mockedSendExpoPush.mock.calls[0];
      expect(token).toBe('ExponentPushToken[abc]');
      expect(body.toLowerCase()).toContain('ready');
    });

    it('does not SMS by default even when a phone is present', async () => {
      await patchStatus('READY');
      await flushAsync();
      expect(mockedSendSMS).not.toHaveBeenCalled();
    });

    it('keeps the generic email and push for READY on a DELIVERY order', async () => {
      mockedPrisma.order.update.mockResolvedValue({
        ...readyPickupOrder,
        orderType: 'DELIVERY',
      } as any);

      await patchStatus('READY');
      await flushAsync();

      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      expect(mockedSendEmail.mock.calls[0][0].subject).toBe('Order #KA-ABC-123 - READY');
      expect(mockedSendExpoPush).not.toHaveBeenCalled();
      expect(mockedEmitStatus.mock.calls[0][1]).toEqual({ suppressPush: false });
    });

    it('fires nothing when the status is unchanged (READY -> READY)', async () => {
      mockedPrisma.order.findUnique.mockResolvedValue({
        ...sampleOrder,
        status: 'READY',
        orderType: 'PICKUP',
        customer: null,
        guestEmail: 'guest@test.com',
      } as any);

      const res = await patchStatus('READY');
      expect(res.status).toBe(200);
      await flushAsync();

      expect(mockedSendEmail).not.toHaveBeenCalled();
      expect(mockedSendSMS).not.toHaveBeenCalled();
      expect(mockedSendExpoPush).not.toHaveBeenCalled();
      expect(mockedEmitStatus).not.toHaveBeenCalled();
      expect(mockedPrisma.order.update).not.toHaveBeenCalled();
    });

    it('does not expose customer contact details in the status-update response', async () => {
      mockedPrisma.order.update.mockResolvedValue({
        ...readyPickupOrder,
        customer: { email: 'cust@test.com', phone: '+61411111111', expoPushToken: 'ExponentPushToken[abc]' },
        table: { name: 'Table 4' },
      } as any);

      const res = await patchStatus('READY');
      expect(res.status).toBe(200);
      expect(res.body.data.customer).toBeUndefined();
      expect(res.body.data.table).toBeUndefined();
      await flushAsync();
    });

    it('does not expose customer contact details in the automation status-change event', async () => {
      const emitSpy = vi.spyOn(appEvents, 'emit');
      mockedPrisma.order.update.mockResolvedValue({
        ...readyPickupOrder,
        customer: { email: 'cust@test.com', phone: '+61411111111', expoPushToken: 'ExponentPushToken[abc]' },
        table: { name: 'Table 4' },
      } as any);

      const res = await patchStatus('READY');
      expect(res.status).toBe(200);

      const statusChangedCall = emitSpy.mock.calls.find(([event]) => event === 'order.statusChanged');
      expect(statusChangedCall).toBeDefined();
      expect(statusChangedCall?.[1]).toEqual({
        order: expect.not.objectContaining({
          customer: expect.anything(),
          table: expect.anything(),
        }),
        previousStatus: 'PENDING',
      });
    });

    it('keeps the generic email for non-READY transitions and fires no fan-out', async () => {
      mockedPrisma.order.update.mockResolvedValue({
        ...readyPickupOrder,
        status: 'PREPARING',
      } as any);

      await patchStatus('PREPARING');
      await flushAsync();

      expect(mockedSendEmail).toHaveBeenCalledTimes(1);
      expect(mockedSendEmail.mock.calls[0][0].subject).toContain('PREPARING');
      expect(mockedSendSMS).not.toHaveBeenCalled();
      expect(mockedSendExpoPush).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // DINE-IN (QR ordering)
  // ============================================================
  describe('POST /api/orders - dine-in', () => {
    const activeTable = { id: 'table-1', locationId: 'loc-1', name: 'Table 4', isActive: true, qrToken: 'tok-valid' };

    it('creates a DINE_IN order from a valid table token, no address or guest contact required', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.siteSettings.findUnique.mockResolvedValue({ orderSettings: { dineInEnabled: true } } as any);
      mockedPrisma.table.findFirst.mockResolvedValue(activeTable as any);
      mockedPrisma.order.create.mockResolvedValue({ ...sampleOrder, orderType: 'DINE_IN', tableId: 'table-1' } as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      const res = await request(app).post('/api/orders').send({
        orderType: 'DINE_IN',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
        tableToken: 'tok-valid',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.orderType).toBe('DINE_IN');
      expect(res.body.data.tableId).toBe('table-1');
      // the resolved table id must be persisted on the order
      expect(mockedPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tableId: 'table-1', orderType: 'DINE_IN' }) }),
      );
    });

    it('rejects a DINE_IN order with no table token', async () => {
      const res = await request(app).post('/api/orders').send({
        orderType: 'DINE_IN',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('table');
    });

    it('rejects a DINE_IN order with an unknown or inactive table token', async () => {
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.siteSettings.findUnique.mockResolvedValue({ orderSettings: { dineInEnabled: true } } as any);
      mockedPrisma.table.findFirst.mockResolvedValue(null);

      const res = await request(app).post('/api/orders').send({
        orderType: 'DINE_IN',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
        tableToken: 'tok-bogus',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('table');
    });

    it('rejects a DINE_IN order when dine-in is disabled in settings', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.siteSettings.findUnique.mockResolvedValue({ orderSettings: { dineInEnabled: false } } as any);

      const res = await request(app).post('/api/orders').send({
        orderType: 'DINE_IN',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
        tableToken: 'tok-valid',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not currently available');
      expect(mockedPrisma.table.findFirst).not.toHaveBeenCalled();
    });
  });
});
