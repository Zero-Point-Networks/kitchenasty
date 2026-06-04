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

// ---------- company + office (Inka corporate-lunch model) ----------

const updateCustomerSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    role: z.enum(['EMPLOYEE', 'MANAGER']).optional(),
    officeId: z.string().nullable().optional(),
  })
  .strict();

/// Customer self-update for the bits the app surfaces from Profile:
/// display name, phone, role flip (the segmented Personal⇄Manager
/// control), and the active office (when a Company has multiple).
export async function updateMe(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const parsed = updateCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }

  // Refuse an officeId from a company the customer doesn't belong to —
  // prevents flipping into someone else's office via a guessed cuid.
  if (parsed.data.officeId) {
    const current = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { companyId: true },
    });
    const office = await prisma.office.findUnique({
      where: { id: parsed.data.officeId },
      select: { companyId: true },
    });
    if (!office || office.companyId !== current?.companyId) {
      res.status(403).json({ success: false, error: 'Office not in your company' });
      return;
    }
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      officeId: true,
      companyId: true,
    },
  });

  res.json({ success: true, data: customer });
}

/// Returns the company the customer matched into (or null), plus its
/// office list — the team screen + role-select use this.
export async function getMyCompany(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      company: {
        select: {
          id: true,
          name: true,
          emailDomain: true,
          allowancePerWeekdayCents: true,
          offices: {
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  });

  res.json({ success: true, data: customer?.company ?? null });
}

/// Manager-only — list members of the requesting user's company so the
/// Team screen can show "18 of 24 locked in" + per-person status pills.
export async function listCompanyMembers(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;

  const me = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { companyId: true, role: true },
  });
  if (!me?.companyId) {
    res.status(404).json({ success: false, error: 'No company linked' });
    return;
  }
  if (me.role !== 'MANAGER') {
    res.status(403).json({ success: false, error: 'Manager only' });
    return;
  }

  const members = await prisma.customer.findMany({
    where: { companyId: me.companyId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      officeId: true,
    },
  });

  res.json({ success: true, data: members });
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
