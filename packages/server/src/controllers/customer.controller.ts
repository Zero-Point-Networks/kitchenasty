import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';

// ---------- shared helpers ----------

function getCustomerId(req: Request): string | null {
  const user = (req as any).user;
  if (!user || user.type !== 'customer') return null;
  return user.id;
}

function requireCustomer(req: Request, res: Response): string | null {
  const id = getCustomerId(req);
  if (!id) {
    res.status(401).json({ success: false, error: 'Customer authentication required' });
    return null;
  }
  return id;
}

// ---------- preferences ----------

// Kept loose so the client can evolve the shape without a migration.
// Server only validates that the top-level keys are the ones we expect
// and the nested types are sane.
const preferencesSchema = z
  .object({
    diet: z.array(z.string()).optional(),
    avoidAllergenIds: z.array(z.string()).optional(),
    spice: z.enum(['mild', 'medium', 'hot']).optional(),
  })
  .strict();

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { preferences: parsed.data },
    select: { id: true, preferences: true },
  });

  res.json({ success: true, data: customer });
}

// ---------- addresses ----------

const addressSchema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

const partialAddressSchema = addressSchema.partial();

export async function listAddresses(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const addresses = await prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  res.json({ success: true, data: addresses });
}

export async function createAddress(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }

  // First address auto-becomes the default; explicit default flips any
  // previous default off so there's only ever one.
  const isFirst = (await prisma.address.count({ where: { customerId } })) === 0;
  const wantsDefault = parsed.data.isDefault === true || isFirst;
  if (wantsDefault) {
    await prisma.address.updateMany({
      where: { customerId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      ...parsed.data,
      isDefault: wantsDefault,
      customerId,
    },
  });

  res.status(201).json({ success: true, data: address });
}

export async function updateAddress(req: Request<{ id: string }>, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const { id } = req.params;
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customerId) {
    res.status(404).json({ success: false, error: 'Address not found' });
    return;
  }

  const parsed = partialAddressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }

  if (parsed.data.isDefault === true) {
    await prisma.address.updateMany({
      where: { customerId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({ where: { id }, data: parsed.data });
  res.json({ success: true, data: address });
}

export async function deleteAddress(req: Request<{ id: string }>, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const { id } = req.params;
  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customerId) {
    res.status(404).json({ success: false, error: 'Address not found' });
    return;
  }

  await prisma.address.delete({ where: { id } });

  // If we deleted the default, promote the most recently used one (if any).
  if (existing.isDefault) {
    const replacement = await prisma.address.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (replacement) {
      await prisma.address.update({ where: { id: replacement.id }, data: { isDefault: true } });
    }
  }

  res.json({ success: true, data: { id } });
}
