import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';

const publicationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  notes: z.string().optional(),
  menuItemIds: z.array(z.string().min(1)).min(0),
});

function dateUtc(s: string): Date {
  const d = new Date(s);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function listPublications(req: Request, res: Response): Promise<void> {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const where: Record<string, unknown> = {};
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = dateUtc(from);
    if (to) range.lte = dateUtc(to);
    where.date = range;
  }
  const pubs = await prisma.menuPublication.findMany({
    where,
    orderBy: { date: 'asc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          menuItem: { select: { id: true, name: true, slug: true, price: true, image: true } },
        },
      },
    },
  });
  res.json({ success: true, data: pubs });
}

export async function getPublication(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id } = req.params;
  const pub = await prisma.menuPublication.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: { menuItem: { select: { id: true, name: true, slug: true, price: true, image: true } } },
      },
    },
  });
  if (!pub) {
    res.status(404).json({ success: false, error: 'Publication not found' });
    return;
  }
  res.json({ success: true, data: pub });
}

/// Upsert by date. POST is the staff workflow: "publish this menu for
/// 2026-06-09" — if a publication for that date exists, swap its items.
export async function upsertPublication(req: Request, res: Response): Promise<void> {
  const parsed = publicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }
  const date = dateUtc(parsed.data.date);
  const { menuItemIds, notes } = parsed.data;

  // De-dupe item ids while preserving order so the storefront ordering
  // mirrors the admin's drag-sort.
  const seen = new Set<string>();
  const uniqueIds = menuItemIds.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));

  const existing = await prisma.menuPublication.findUnique({ where: { date } });
  const pub = existing
    ? await prisma.menuPublication.update({
        where: { id: existing.id },
        data: {
          notes,
          publishedAt: new Date(),
          items: {
            deleteMany: {},
            create: uniqueIds.map((id, idx) => ({ menuItem: { connect: { id } }, sortOrder: idx })),
          },
        },
        include: { items: true },
      })
    : await prisma.menuPublication.create({
        data: {
          date,
          notes,
          items: { create: uniqueIds.map((id, idx) => ({ menuItem: { connect: { id } }, sortOrder: idx })) },
        },
        include: { items: true },
      });

  res.status(existing ? 200 : 201).json({ success: true, data: pub });
}

export async function deletePublication(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id } = req.params;
  const existing = await prisma.menuPublication.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Publication not found' });
    return;
  }
  await prisma.menuPublication.delete({ where: { id } });
  res.json({ success: true, data: { id } });
}
