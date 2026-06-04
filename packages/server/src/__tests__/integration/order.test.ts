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
    coupon: { findUnique: vi.fn(), update: vi.fn() },
    siteSettings: { findUnique: vi.fn() },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

import prisma from '../../lib/db.js';
const mockedPrisma = vi.mocked(prisma);

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
    // Default: no custom lock-in cutoff (controller falls back to 21:00).
    // Individual tests can override this for cutoff scenarios.
    mockedPrisma.siteSettings.findUnique.mockResolvedValue(null as any);
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
  // COUPON APPLICATION (smoke)
  // ============================================================
  describe('POST /api/orders — coupon application', () => {
    const percentageCoupon = {
      id: 'coupon-pct',
      code: 'TENOFF',
      type: 'PERCENTAGE',
      value: 10,
      minOrder: 10,
      maxDiscount: null,
      usageLimit: null,
      usageCount: 4,
      perCustomer: 1,
      startsAt: null,
      expiresAt: null,
      isActive: true,
    };
    const freeDeliveryCoupon = {
      id: 'coupon-fd',
      code: 'FREESHIP',
      type: 'FREE_DELIVERY',
      value: 0,
      minOrder: 0,
      maxDiscount: null,
      usageLimit: null,
      usageCount: 0,
      perCustomer: 1,
      startsAt: null,
      expiresAt: null,
      isActive: true,
    };
    const sampleItemForCoupon = { ...sampleMenuItem, price: 9 }; // qty 2 → subtotal 18

    it('applies a PERCENTAGE coupon: discount 1.80, total drops, usageCount increments', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleItemForCoupon] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.coupon.findUnique.mockResolvedValue(percentageCoupon as any);
      mockedPrisma.coupon.update.mockResolvedValue({ ...percentageCoupon, usageCount: 5 } as any);
      mockedPrisma.order.create.mockImplementation(async (args: any) => ({
        ...sampleOrder,
        subtotal: args.data.subtotal,
        discount: args.data.discount,
        deliveryFee: args.data.deliveryFee,
        total: args.data.total,
        couponId: args.data.couponId,
        items: [],
      }) as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      const res = await request(app).post('/api/orders').send({
        orderType: 'PICKUP',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
        couponCode: 'TENOFF',
        guestName: 'G',
        guestEmail: 'g@test.com',
      });

      expect(res.status).toBe(201);
      // subtotal 18 * 10% = 1.80
      expect(res.body.data.discount).toBeCloseTo(1.80, 2);
      expect(res.body.data.couponId).toBe('coupon-pct');
      // Without coupon: 18 + 1.44 tax = 19.44. With: 19.44 - 1.80 = 17.64
      expect(res.body.data.total).toBeLessThan(19.44);
      expect(mockedPrisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-pct' },
        data: { usageCount: { increment: 1 } },
      });
    });

    it('FREE_DELIVERY coupon zeroes deliveryFee on a delivery order', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleItemForCoupon] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.deliveryZone.findFirst.mockResolvedValue({ id: 'z1', charge: 4.99 } as any);
      mockedPrisma.deliveryZone.findMany.mockResolvedValue([]);
      mockedPrisma.coupon.findUnique.mockResolvedValue(freeDeliveryCoupon as any);
      mockedPrisma.coupon.update.mockResolvedValue({ ...freeDeliveryCoupon, usageCount: 1 } as any);
      mockedPrisma.order.create.mockImplementation(async (args: any) => ({
        ...sampleOrder,
        orderType: 'DELIVERY',
        subtotal: args.data.subtotal,
        discount: args.data.discount,
        deliveryFee: args.data.deliveryFee,
        total: args.data.total,
        couponId: args.data.couponId,
        items: [],
      }) as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      const res = await request(app).post('/api/orders').send({
        orderType: 'DELIVERY',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
        couponCode: 'FREESHIP',
        address: { line1: '123 Main St', city: 'X', state: 'Y', zip: '00000' },
        guestName: 'G',
        guestEmail: 'g@test.com',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.deliveryFee).toBe(0);
      expect(res.body.data.discount).toBe(0); // FREE_DELIVERY does not flow into discount
      expect(res.body.data.couponId).toBe('coupon-fd');
    });

    it('returns 400 (NOT 500) when coupon is unknown', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleItemForCoupon] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      mockedPrisma.coupon.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/orders').send({
        orderType: 'PICKUP',
        items: [{ menuItemId: 'item-1', quantity: 2 }],
        couponCode: 'NOSUCH',
        guestName: 'G',
        guestEmail: 'g@test.com',
      });

      // CouponError("Invalid coupon code", 404) → mapped to its statusCode
      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================
  // LOCK-IN CUTOFF (smoke — regression on 2c1fe4a)
  // ============================================================
  describe('POST /api/orders — lock-in cutoff', () => {
    it('returns 400 (not 500) when item.forDate is past the cutoff', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      // Cutoff already passed: 00:00. Any forDate in the future still
      // requires the order BEFORE 00:00 the day before — which by
      // definition has already passed for "tomorrow".
      mockedPrisma.siteSettings.findUnique.mockResolvedValue({
        id: 'default',
        orderSettings: { lockInCutoff: '00:00' },
      } as any);
      mockedPrisma.order.create.mockResolvedValue(sampleOrder as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      // forDate = tomorrow (cutoff was 00:00 yesterday — already past)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const forDate = tomorrow.toISOString().slice(0, 10);

      const res = await request(app).post('/api/orders').send({
        orderType: 'PICKUP',
        items: [{ menuItemId: 'item-1', quantity: 1, forDate }],
        guestName: 'G',
        guestEmail: 'g@test.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(String(res.body.error)).toMatch(/Lock-in|cutoff/i);
      // Crucially: prisma.order.create must NOT have been called
      expect(mockedPrisma.order.create).not.toHaveBeenCalled();
    });

    it('accepts the order when forDate is well within the cutoff window', async () => {
      mockedPrisma.menuItem.findMany.mockResolvedValue([sampleMenuItem] as any);
      mockedPrisma.location.findFirst.mockResolvedValue(sampleLocation as any);
      // Cutoff at 23:59 — anything before midnight of D-1 is allowed.
      mockedPrisma.siteSettings.findUnique.mockResolvedValue({
        id: 'default',
        orderSettings: { lockInCutoff: '23:59' },
      } as any);
      mockedPrisma.order.create.mockResolvedValue(sampleOrder as any);
      mockedPrisma.automationRule.findMany.mockResolvedValue([]);

      // forDate = 10 days out, well within the 14-day window
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const forDate = future.toISOString().slice(0, 10);

      const res = await request(app).post('/api/orders').send({
        orderType: 'PICKUP',
        items: [{ menuItemId: 'item-1', quantity: 1, forDate }],
        guestName: 'G',
        guestEmail: 'g@test.com',
      });

      expect(res.status).toBe(201);
    });
  });
});
