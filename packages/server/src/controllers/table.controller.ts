import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { generateQrToken, tableQrUrl } from '../lib/qr.js';

const createTableSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().min(1),
  isActive: z.boolean().default(true),
});

const updateTableSchema = createTableSchema.partial();

export async function listTables(req: Request<{ locationId: string }>, res: Response): Promise<void> {
  const { locationId } = req.params;

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    res.status(404).json({ success: false, error: 'Location not found' });
    return;
  }

  const tables = await prisma.table.findMany({
    where: { locationId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { reservations: true } },
    },
  });

  res.json({ success: true, data: tables });
}

export async function getTable(req: Request<{ locationId: string; tableId: string }>, res: Response): Promise<void> {
  const { locationId, tableId } = req.params;

  const table = await prisma.table.findFirst({
    where: { id: tableId, locationId },
    include: {
      _count: { select: { reservations: true } },
    },
  });

  if (!table) {
    res.status(404).json({ success: false, error: 'Table not found' });
    return;
  }

  res.json({ success: true, data: table });
}

export async function createTable(req: Request<{ locationId: string }>, res: Response): Promise<void> {
  const { locationId } = req.params;
  const parsed = createTableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    res.status(404).json({ success: false, error: 'Location not found' });
    return;
  }

  // Check unique name within location
  const existing = await prisma.table.findFirst({
    where: { locationId, name: parsed.data.name },
  });
  if (existing) {
    res.status(409).json({ success: false, error: 'A table with this name already exists at this location' });
    return;
  }

  const table = await prisma.table.create({
    data: { locationId, ...parsed.data },
  });

  res.status(201).json({ success: true, data: table });
}

export async function updateTable(req: Request<{ locationId: string; tableId: string }>, res: Response): Promise<void> {
  const { locationId, tableId } = req.params;
  const parsed = updateTableSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }

  const table = await prisma.table.findFirst({
    where: { id: tableId, locationId },
  });
  if (!table) {
    res.status(404).json({ success: false, error: 'Table not found' });
    return;
  }

  // If renaming, check uniqueness
  if (parsed.data.name && parsed.data.name !== table.name) {
    const duplicate = await prisma.table.findFirst({
      where: { locationId, name: parsed.data.name },
    });
    if (duplicate) {
      res.status(409).json({ success: false, error: 'A table with this name already exists at this location' });
      return;
    }
  }

  const updated = await prisma.table.update({
    where: { id: tableId },
    data: parsed.data,
  });

  res.json({ success: true, data: updated });
}

// Public: resolve a dine-in QR token to its location + table identity.
// Exposes only labels (no sensitive data) so the storefront can bootstrap
// the dine-in context after a guest scans a code.
export async function resolveTableByToken(req: Request<{ qrToken: string }>, res: Response): Promise<void> {
  const { qrToken } = req.params;

  const table = await prisma.table.findFirst({
    where: { qrToken, isActive: true },
    include: { location: { select: { id: true, name: true } } },
  });

  if (!table) {
    res.status(404).json({ success: false, error: 'Table not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      locationId: table.location.id,
      locationName: table.location.name,
      tableId: table.id,
      tableName: table.name,
    },
  });
}

// Staff: set or rotate a table's QR token and return the scannable URL.
// Rotating invalidates any previously printed code for this table.
export async function generateTableQr(req: Request<{ locationId: string; tableId: string }>, res: Response): Promise<void> {
  const { locationId, tableId } = req.params;

  const table = await prisma.table.findFirst({
    where: { id: tableId, locationId },
  });
  if (!table) {
    res.status(404).json({ success: false, error: 'Table not found' });
    return;
  }

  const qrToken = generateQrToken();
  await prisma.table.update({
    where: { id: tableId },
    data: { qrToken },
  });

  res.json({ success: true, data: { qrToken, url: tableQrUrl(qrToken) } });
}

export async function deleteTable(req: Request<{ locationId: string; tableId: string }>, res: Response): Promise<void> {
  const { locationId, tableId } = req.params;

  const table = await prisma.table.findFirst({
    where: { id: tableId, locationId },
  });
  if (!table) {
    res.status(404).json({ success: false, error: 'Table not found' });
    return;
  }

  const reservationCount = await prisma.reservation.count({
    where: { tableId },
  });
  if (reservationCount > 0) {
    res.status(409).json({
      success: false,
      error: 'Cannot delete table with existing reservations. Deactivate it instead.',
    });
    return;
  }

  await prisma.table.delete({ where: { id: tableId } });
  res.json({ success: true, message: 'Table deleted' });
}
