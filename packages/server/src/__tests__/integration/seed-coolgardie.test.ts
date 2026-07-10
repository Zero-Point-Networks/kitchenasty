import path from 'path';
import { promises as fs } from 'fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedCoolgardie } from '../../../../../prisma/seed-coolgardie.js';

// Unlike the other integration tests (which mock lib/db.js), this one exercises
// the real data layer and needs a migrated PostgreSQL database. It skips cleanly
// when DATABASE_URL is not configured.
//
// Coexistence with the demo seed (disjoint slugs, SiteSettings full-overwrite)
// is asserted indirectly here (see the grilled-salmon-gold-rush spot check):
// prisma/seed.ts runs main() as an import side effect with its own client, so
// it cannot be sequenced safely inside this suite, and the spec keeps that
// file untouched.
const hasDb = Boolean(process.env.DATABASE_URL);
const imageSubdir = 'coolgardie-menu';

async function findProjectRoot(): Promise<string> {
  let current = process.cwd();
  while (true) {
    try {
      const stats = await fs.stat(path.join(current, 'prisma', 'seed-assets', imageSubdir));
      if (stats.isDirectory()) return current;
    } catch {
      // Keep walking toward the filesystem root.
    }

    const parent = path.dirname(current);
    if (parent === current) throw new Error(`project root not found from ${process.cwd()}`);
    current = parent;
  }
}

async function expectGeneratedMenuImages(prisma: PrismaClient, locationId: string): Promise<void> {
  const projectRoot = await findProjectRoot();
  const sourceDir = path.join(projectRoot, 'prisma', 'seed-assets', imageSubdir);
  const uploadDirs = [
    process.env.UPLOADS_DIR ? path.join(path.resolve(process.env.UPLOADS_DIR), imageSubdir) : null,
    path.resolve(process.cwd(), 'uploads', imageSubdir),
    path.join(projectRoot, 'uploads', imageSubdir),
    path.join(projectRoot, 'packages', 'server', 'uploads', imageSubdir),
  ].filter((dir): dir is string => Boolean(dir));

  const items = await prisma.menuItem.findMany({
    where: { locationId },
    select: { slug: true, image: true },
  });

  expect(items).toHaveLength(41);
  for (const item of items) {
    const filename = `${item.slug}.webp`;
    const source = await fs.stat(path.join(sourceDir, filename));
    expect(source.size).toBeGreaterThan(0);
    expect(item.image).toBe(`/uploads/${imageSubdir}/${filename}`);

    for (const uploadDir of uploadDirs) {
      const copied = await fs.stat(path.join(uploadDir, filename));
      expect(copied.size).toBe(source.size);
    }
  }
}

describe.skipIf(!hasDb)('Coolgardie venue seed - Integration Tests', () => {
  let prisma: PrismaClient;
  let locationId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await seedCoolgardie(prisma);
    const location = await prisma.location.findUnique({ where: { slug: 'coolgardie' } });
    if (!location) throw new Error('seed did not create the coolgardie location');
    locationId = location.id;
  }, 60000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe('site settings', () => {
    it('applies Coolgardie branding to the default SiteSettings row', async () => {
      const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
      expect(settings?.siteName).toBe('Coolgardie Gold Rush Motel');
      expect(settings?.storefrontTemplate).toBe('rustic');
      expect(settings?.colorPrimary).toBe('#d4a017');
      expect(settings?.colorSecondary).toBe('#7c4a21');
    });

    it('configures AUD currency and Perth timezone in generalSettings', async () => {
      const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
      const general = settings?.generalSettings as Record<string, unknown>;
      expect(general.defaultCurrency).toBe('AUD');
      expect(general.timezone).toBe('Australia/Perth');
    });
  });

  describe('admin user', () => {
    it('creates the venue admin as SUPER_ADMIN', async () => {
      const admin = await prisma.user.findUnique({
        where: { email: 'admin@coolgardiegoldrushmotel.com.au' },
      });
      expect(admin?.role).toBe('SUPER_ADMIN');
      expect(admin?.isActive).toBe(true);
    });
  });

  describe('location', () => {
    it('creates the coolgardie location with pickup only', async () => {
      const location = await prisma.location.findUnique({ where: { slug: 'coolgardie' } });
      expect(location).not.toBeNull();
      expect(location?.deliveryEnabled).toBe(false);
      expect(location?.pickupEnabled).toBe(true);
      expect(location?.city).toBe('Coolgardie');
      expect(location?.country).toBe('AU');
    });

    it('creates 7 operating hours (daily 17:30-19:30)', async () => {
      const hours = await prisma.operatingHour.findMany({ where: { locationId } });
      expect(hours).toHaveLength(7);
      for (const hour of hours) {
        expect(hour.openTime).toBe('17:30');
        expect(hour.closeTime).toBe('19:30');
        expect(hour.isClosed).toBe(false);
      }
    });

    it('creates 10 tables totalling 44 seats', async () => {
      const tables = await prisma.table.findMany({ where: { locationId } });
      expect(tables).toHaveLength(10);
      expect(tables.reduce((sum, t) => sum + t.capacity, 0)).toBe(44);
    });

    it('assigns each table a unique random QR token (never the public dev token)', async () => {
      const tables = await prisma.table.findMany({ where: { locationId } });
      for (const table of tables) {
        expect(table.qrToken).toBeTruthy();
        expect(table.qrToken).not.toBe('dev-table-1-qr');
        // randomBytes(18).toString('base64url') → 24 chars, matching lib/qr.ts
        expect(table.qrToken?.length).toBeGreaterThanOrEqual(24);
      }
      expect(new Set(tables.map((t) => t.qrToken)).size).toBe(tables.length);
    });
  });

  describe('order settings', () => {
    it('enables dine-in QR ordering', async () => {
      const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
      const order = settings?.orderSettings as Record<string, unknown>;
      expect(order.dineInEnabled).toBe(true);
    });
  });

  describe('menu', () => {
    it('creates 9 categories for the location', async () => {
      const count = await prisma.category.count({ where: { locationId } });
      expect(count).toBe(9);
    });

    it('creates 41 menu items for the location', async () => {
      const count = await prisma.menuItem.count({ where: { locationId } });
      expect(count).toBe(41);
    });

    it('sets generated placeholder image paths and copies files for every menu item', async () => {
      await expectGeneratedMenuImages(prisma, locationId);
    });

    it('files items under their primary category (PDF cross-listings ignored)', async () => {
      const counts = await Promise.all(
        ['mains', 'vegetarian', 'pasta', 'starters'].map((slug) =>
          prisma.menuItem.count({ where: { locationId, category: { slug } } })
        )
      );
      expect(counts).toEqual([9, 2, 2, 7]);
    });

    it('avoids the demo-seed slug collision on Grilled Salmon', async () => {
      const salmon = await prisma.menuItem.findUnique({
        where: { slug: 'grilled-salmon-gold-rush' },
      });
      expect(salmon?.name).toBe('Grilled Salmon');
      expect(salmon?.price).toBe(35);
      expect(salmon?.locationId).toBe(locationId);
    });

    it('links every menu item to the Dinner mealtime', async () => {
      const dinner = await prisma.mealtime.findFirst({ where: { name: 'Dinner', locationId } });
      expect(dinner).not.toBeNull();
      const links = await prisma.menuItemMealtime.count({ where: { mealtimeId: dinner?.id } });
      expect(links).toBe(41);
    });

    it('seeds the 8 standard allergens with unambiguous associations only', async () => {
      expect(await prisma.allergen.count()).toBeGreaterThanOrEqual(8);
      const twisters = await prisma.menuItem.findUnique({
        where: { slug: 'prawn-twisters' },
        include: { allergens: { include: { allergen: true } } },
      });
      expect(twisters?.allergens.map((a) => a.allergen.name)).toContain('Shellfish');
      const steak = await prisma.menuItem.findUnique({
        where: { slug: 'grilled-sirloin-steak' },
        include: { allergens: true },
      });
      expect(steak?.allergens).toHaveLength(0); // (GF) — no Gluten tag
    });
  });

  describe('menu options', () => {
    it('gives Grilled Sirloin Steak its 3 option groups with correct shape', async () => {
      const steak = await prisma.menuItem.findUnique({
        where: { slug: 'grilled-sirloin-steak' },
        include: { options: { include: { values: true }, orderBy: { sortOrder: 'asc' } } },
      });
      expect(steak?.options).toHaveLength(3);

      const [sides, prawns, sauce] = steak?.options ?? [];
      expect(sides.name).toBe('Sides');
      expect(sides.displayType).toBe('RADIO');
      expect(sides.isRequired).toBe(true);
      expect(sides.values.map((v) => v.name)).toEqual(['Chips & Salad', 'Mash & Vegetables']);

      expect(prawns.name).toBe('Add Garlic Prawns');
      expect(prawns.displayType).toBe('CHECKBOX');
      expect(prawns.values[0].priceModifier).toBe(12);

      expect(sauce.name).toBe('Add a Sauce');
      expect(sauce.maxSelect).toBe(2);
      expect(sauce.values).toHaveLength(4);
      expect(sauce.values.every((v) => v.priceModifier === 6)).toBe(true);
    });

    it('gives Buffalo Wings a Sides group and a required Sauce choice', async () => {
      const wings = await prisma.menuItem.findUnique({
        where: { slug: 'buffalo-wings' },
        include: { options: { include: { values: true } } },
      });
      expect(wings?.options).toHaveLength(2);
      const sauce = wings?.options.find((o) => o.name === 'Sauce');
      expect(sauce?.isRequired).toBe(true);
      expect(sauce?.values.map((v) => v.name).sort()).toEqual(['Garlic Sauce', 'Sweet Chilli Sauce']);
    });

    it('gives Ice Cream a required Topping choice with 3 values', async () => {
      const iceCream = await prisma.menuItem.findUnique({
        where: { slug: 'ice-cream' },
        include: { options: { include: { values: true } } },
      });
      expect(iceCream?.options).toHaveLength(1);
      expect(iceCream?.options[0].values).toHaveLength(3);
    });
  });

  describe('idempotency', () => {
    it('does not overwrite venue-uploaded menu item images on re-run', async () => {
      const slug = 'grilled-sirloin-steak';
      const venueImage = '/uploads/venue-owned/grilled-sirloin-steak.jpg';
      const placeholderImage = `/uploads/${imageSubdir}/${slug}.webp`;

      try {
        await prisma.menuItem.update({ where: { slug }, data: { image: venueImage } });
        await seedCoolgardie(prisma);

        const item = await prisma.menuItem.findUnique({ where: { slug } });
        expect(item?.image).toBe(venueImage);
      } finally {
        await prisma.menuItem.update({ where: { slug }, data: { image: placeholderImage } });
      }
    });

    it('keeps table QR tokens stable across reseed', async () => {
      const byName = (rows: Array<{ name: string; qrToken: string | null }>): Array<[string, string | null]> =>
        rows.map((r): [string, string | null] => [r.name, r.qrToken]).sort((a, b) => a[0].localeCompare(b[0]));

      const before = await prisma.table.findMany({
        where: { locationId },
        select: { name: true, qrToken: true },
      });
      await seedCoolgardie(prisma);
      const after = await prisma.table.findMany({
        where: { locationId },
        select: { name: true, qrToken: true },
      });
      expect(byName(after)).toEqual(byName(before));
    });

    it('re-running the seed leaves seeded row counts unchanged', async () => {
      const snapshot = async (): Promise<Record<string, number>> => ({
        categories: await prisma.category.count({ where: { locationId } }),
        items: await prisma.menuItem.count({ where: { locationId } }),
        options: await prisma.menuOption.count({ where: { menuItem: { locationId } } }),
        tables: await prisma.table.count({ where: { locationId } }),
        hours: await prisma.operatingHour.count({ where: { locationId } }),
        mealtimes: await prisma.mealtime.count({ where: { locationId } }),
        mealtimeLinks: await prisma.menuItemMealtime.count({
          where: { menuItem: { locationId } },
        }),
        allergenLinks: await prisma.menuItemAllergen.count({
          where: { menuItem: { locationId } },
        }),
      });

      const before = await snapshot();
      await seedCoolgardie(prisma);
      const after = await snapshot();
      expect(after).toEqual(before);
      await expectGeneratedMenuImages(prisma, locationId);
    });
  });
});
