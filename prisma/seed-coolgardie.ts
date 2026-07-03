import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

// Venue seed for the Coolgardie Gold Rush Motel restaurant.
// Source: https://www.coolgardiegoldrushmotel.com.au/restaurant-coolgardie
// and the venue's June 2025 menu PDF (captured in
// specs/in-progress/coolgardie-branding-menu-seed.md).
//
// Intended for a fresh database (production provisioning) — idempotent, and
// additive to the demo seed (prisma/seed.ts), which stays untouched.
// Run with: npm run db:seed:coolgardie -w packages/server

const ADMIN_EMAIL = 'admin@coolgardiegoldrushmotel.com.au';

const coolgardieSettings = {
  siteName: 'Coolgardie Gold Rush Motel',
  siteTitle: 'Coolgardie Gold Rush Motel — Licensed Restaurant',
  logo: 'https://lirp.cdn-website.com/8c29b248/dms3rep/multi/opt/1-1Uo9IhJHB-transformed-removebg-preview+%281%29-1920w.png',
  colorPrimary: '#d4a017',
  colorSecondary: '#7c4a21',
  darkMode: 'light',
  storefrontTemplate: 'rustic',
  heroSection: {
    title: 'Home-Style Dining in the Heart of the Goldfields',
    subtitle:
      'A hidden gem in Coolgardie — home-style cooked meals, daily specials, and warm hospitality at our fully licensed restaurant.',
    backgroundImage: '', // admin uploads a venue photo later
    ctaPrimaryText: 'View Our Menu',
    ctaPrimaryLink: '/menu',
    ctaSecondaryText: 'Book a Table',
    ctaSecondaryLink: '/reservations',
  },
  featuresSection: [
    {
      icon: '🍽️',
      title: 'Home-Style Meals',
      description:
        'Hearty home-style cooked meals and daily specials, with a seasonal menu for diverse dietary needs',
    },
    {
      icon: '🍺',
      title: 'Fully Licensed',
      description: 'Relax with a drink from our licensed bar — open for dinner 7 nights a week',
    },
    {
      icon: '🎉',
      title: 'Functions & Events',
      description: 'Seating for 45 guests — birthdays, meetings, and functions welcome',
    },
  ],
  ctaSection: {
    title: 'Dinner Tonight at the Gold Rush?',
    description: 'Join us any night from 5:30pm — dine in, take away, or book a table for your group.',
    buttonText: 'Order Now',
    buttonLink: '/menu',
  },
  generalSettings: {
    timezone: 'Australia/Perth',
    distanceUnit: 'km',
    defaultCurrency: 'AUD',
    currencySymbol: '$',
    currencyPosition: 'before',
    contactEmail: ADMIN_EMAIL,
    contactPhone: '08 9026 6080',
  },
  // AU menu prices are GST-inclusive, hence taxRate 0.
  orderSettings: { enabled: true, enableTipping: false, taxRate: 0 },
  reservationSettings: { enabled: true, autoConfirm: false },
};

interface SeedMenuItem {
  name: string;
  slug: string;
  price: number;
  description?: string;
  allergens?: string[];
}

interface SeedCategory {
  name: string;
  slug: string;
  items: SeedMenuItem[];
}

// Menu transcribed verbatim from the June 2025 PDF; categories in PDF order.
// Allergen tags cover only unambiguous cases; (GF) items get no Gluten tag.
// Slug note: the demo seed already owns `grilled-salmon`, and MenuItem.slug is
// globally unique — the venue's salmon uses `grilled-salmon-gold-rush` so the
// two seeds can coexist on one database.
const menu: SeedCategory[] = [
  {
    name: 'Starters',
    slug: 'starters',
    items: [
      { name: 'Garlic & Herb Bread', slug: 'garlic-herb-bread', price: 12, description: '2 slices per serve', allergens: ['Gluten', 'Dairy'] },
      { name: 'Cheesy Garlic & Herb Bread', slug: 'cheesy-garlic-herb-bread', price: 14, description: '2 slices per serve', allergens: ['Gluten', 'Dairy'] },
      { name: 'Soup of the Day', slug: 'soup-of-the-day', price: 15 },
      { name: 'Asian Plate', slug: 'asian-plate', price: 15, description: 'Mini dim sims & spring rolls served with sweet chilli sauce', allergens: ['Gluten'] },
      { name: 'Chicken Garlic Balls', slug: 'chicken-garlic-balls', price: 14, description: 'Served with a light coating of garlic sauce' },
      { name: 'Wedges', slug: 'wedges', price: 14, description: 'Served with sour cream and sweet chilli sauce', allergens: ['Dairy'] },
      { name: 'Prawn Twisters', slug: 'prawn-twisters', price: 15, description: 'Served with sweet chilli sauce', allergens: ['Shellfish'] },
    ],
  },
  {
    name: 'Seafood',
    slug: 'seafood',
    items: [
      { name: 'Salt & Pepper Squid', slug: 'salt-pepper-squid', price: 32, description: 'Served with a garden salad, chips and tartare sauce', allergens: ['Shellfish'] },
      { name: 'Prawns (GF)', slug: 'prawns', price: 35, description: 'Lightly sautéed with garlic sauce, served with a garden salad and chips', allergens: ['Shellfish'] },
      { name: 'Beer Battered Flathead', slug: 'beer-battered-flathead', price: 30, description: 'Served with a garden salad, chips and tartare sauce', allergens: ['Gluten', 'Fish'] },
      { name: 'Seafood Basket', slug: 'seafood-basket', price: 28, description: 'Served with a garden salad, chips and tartare sauce', allergens: ['Gluten', 'Fish', 'Shellfish'] },
      { name: 'Grilled Salmon', slug: 'grilled-salmon-gold-rush', price: 35, description: 'Served on a bed of mash potato and vegetables', allergens: ['Fish'] },
    ],
  },
  {
    name: 'Burgers',
    slug: 'burgers',
    items: [
      { name: 'Hamburger with the Lot', slug: 'hamburger-with-the-lot', price: 26, description: 'Bacon, onion, egg, cheese, tomato and lettuce', allergens: ['Gluten', 'Dairy', 'Eggs'] },
      { name: 'Gold Rush Steak Burger', slug: 'gold-rush-steak-burger', price: 28, description: 'Tender sirloin steak with bacon, onion, cheese, tomato, lettuce, BBQ sauce in a toasted Turkish roll, served with a side of chips', allergens: ['Gluten', 'Dairy'] },
    ],
  },
  {
    name: 'Mains',
    slug: 'mains',
    items: [
      { name: 'Grilled Sirloin Steak (GF)', slug: 'grilled-sirloin-steak', price: 40, description: 'Choice of sides; add 4 garlic prawns +$12' },
      { name: 'BBQ Pork Ribs (GF)', slug: 'bbq-pork-ribs', price: 37, description: 'Tennessee BBQ style marinade and rub, served with coleslaw, charred corn and chips' },
      { name: 'Braised Lamb Shank', slug: 'braised-lamb-shank', price: 36, description: 'Cooked in a classic rich red wine sauce seasoned with rosemary, served with mash' },
      { name: 'Rissoles', slug: 'rissoles', price: 27, description: 'Homemade rissoles with mash, vegetables and onion gravy' },
      { name: 'Bangers & Mash', slug: 'bangers-mash', price: 27, description: 'Sausages with mash, vegetables and onion gravy' },
      { name: 'Chicken Parmigiana', slug: 'chicken-parmigiana', price: 30, description: 'Crumbed chicken breast topped with napoleon sauce, ham and cheese; choice of sides', allergens: ['Gluten', 'Dairy'] },
      { name: 'Chicken Schnitzel', slug: 'chicken-schnitzel', price: 27, description: 'Crumbed chicken breast; choice of sides', allergens: ['Gluten'] },
      { name: 'Chicken Kiev', slug: 'chicken-kiev', price: 25, description: 'Golden crumbed chicken filled with garlic sauce; choice of sides', allergens: ['Gluten'] },
      { name: 'Buffalo Wings', slug: 'buffalo-wings', price: 25, description: '5 crumbed chicken wings; choice of sides and choice of garlic or sweet chilli sauce', allergens: ['Gluten'] },
    ],
  },
  {
    name: 'Pasta',
    slug: 'pasta',
    items: [
      { name: 'Pasta Carbonara', slug: 'pasta-carbonara', price: 30, description: 'Linguine tossed through a creamy garlic sauce with bacon, egg, mushrooms and parmesan cheese', allergens: ['Gluten', 'Dairy', 'Eggs'] },
      { name: 'Spaghetti Bolognaise', slug: 'spaghetti-bolognaise', price: 30, description: 'Traditional bolognaise served on linguine, topped with parmesan cheese', allergens: ['Gluten', 'Dairy'] },
    ],
  },
  {
    name: 'Vegetarian',
    slug: 'vegetarian',
    items: [
      { name: 'Vegetarian Stirfry', slug: 'vegetarian-stirfry', price: 25 },
      { name: 'Veggie Burger', slug: 'veggie-burger', price: 25, description: 'Onion, egg, cheese, tomato and lettuce', allergens: ['Gluten', 'Dairy', 'Eggs'] },
    ],
  },
  {
    name: 'Sauces',
    slug: 'sauces',
    items: [
      { name: 'Pepper Sauce', slug: 'pepper-sauce', price: 6 },
      { name: 'Mushroom Sauce', slug: 'mushroom-sauce', price: 6 },
      { name: 'Creamy Garlic Sauce', slug: 'creamy-garlic-sauce', price: 6, allergens: ['Dairy'] },
      { name: 'Gravy', slug: 'gravy', price: 6 },
    ],
  },
  {
    name: 'Kids',
    slug: 'kids',
    items: [
      { name: "Kids Fish 'n' Chips", slug: 'kids-fish-n-chips', price: 15, description: 'Includes a free ice cream', allergens: ['Gluten', 'Fish', 'Dairy'] },
      { name: 'Kids Chicken Schnitzel & Chips', slug: 'kids-chicken-schnitzel-chips', price: 15, description: 'Includes a free ice cream', allergens: ['Gluten', 'Dairy'] },
      { name: 'Kids Nuggets & Chips', slug: 'kids-nuggets-chips', price: 15, description: 'Includes a free ice cream', allergens: ['Gluten', 'Dairy'] },
      { name: 'Kids Spaghetti Bolognaise', slug: 'kids-spaghetti-bolognaise', price: 15, description: 'Includes a free ice cream', allergens: ['Gluten', 'Dairy'] },
    ],
  },
  {
    name: 'Dessert',
    slug: 'dessert',
    items: [
      { name: 'Sticky Date Pudding', slug: 'sticky-date-pudding', price: 15, description: 'Served with ice cream', allergens: ['Gluten', 'Dairy'] },
      { name: 'Apple Crumble', slug: 'apple-crumble', price: 15, description: 'Served with ice cream', allergens: ['Gluten', 'Dairy'] },
      { name: 'Chocolate Bavarian', slug: 'chocolate-bavarian', price: 15, allergens: ['Dairy'] },
      { name: 'Mango & Peach Cheesecake', slug: 'mango-peach-cheesecake', price: 15, allergens: ['Gluten', 'Dairy'] },
      { name: 'Ice Cream Sundae', slug: 'ice-cream-sundae', price: 12, allergens: ['Dairy'] },
      { name: 'Ice Cream', slug: 'ice-cream', price: 8, description: 'Choice of chocolate, strawberry or caramel topping', allergens: ['Dairy'] },
    ],
  },
];

interface SeedOptionValue {
  name: string;
  priceModifier: number;
  isDefault?: boolean;
  sortOrder: number;
}

interface SeedOption {
  name: string;
  displayType: 'RADIO' | 'CHECKBOX';
  isRequired: boolean;
  maxSelect?: number;
  values: { create: SeedOptionValue[] };
}

const SIDES_OPTION: SeedOption = {
  name: 'Sides',
  displayType: 'RADIO',
  isRequired: true,
  values: {
    create: [
      { name: 'Chips & Salad', priceModifier: 0, isDefault: true, sortOrder: 1 },
      { name: 'Mash & Vegetables', priceModifier: 0, sortOrder: 2 },
    ],
  },
};

// Option groups per item slug; guarded by a per-item menuOption.count() check
// so re-seeding doesn't duplicate.
const optionsBySlug: Record<string, SeedOption[]> = {
  'grilled-sirloin-steak': [
    SIDES_OPTION,
    {
      name: 'Add Garlic Prawns',
      displayType: 'CHECKBOX',
      isRequired: false,
      values: { create: [{ name: '4 Garlic Prawns', priceModifier: 12, sortOrder: 1 }] },
    },
    {
      name: 'Add a Sauce',
      displayType: 'CHECKBOX',
      isRequired: false,
      maxSelect: 2,
      values: {
        create: [
          { name: 'Pepper', priceModifier: 6, sortOrder: 1 },
          { name: 'Mushroom', priceModifier: 6, sortOrder: 2 },
          { name: 'Creamy Garlic', priceModifier: 6, sortOrder: 3 },
          { name: 'Gravy', priceModifier: 6, sortOrder: 4 },
        ],
      },
    },
  ],
  'chicken-parmigiana': [SIDES_OPTION],
  'chicken-schnitzel': [SIDES_OPTION],
  'chicken-kiev': [SIDES_OPTION],
  'buffalo-wings': [
    SIDES_OPTION,
    {
      name: 'Sauce',
      displayType: 'RADIO',
      isRequired: true,
      values: {
        create: [
          { name: 'Garlic Sauce', priceModifier: 0, isDefault: true, sortOrder: 1 },
          { name: 'Sweet Chilli Sauce', priceModifier: 0, sortOrder: 2 },
        ],
      },
    },
  ],
  'ice-cream': [
    {
      name: 'Topping',
      displayType: 'RADIO',
      isRequired: true,
      values: {
        create: [
          { name: 'Chocolate', priceModifier: 0, isDefault: true, sortOrder: 1 },
          { name: 'Strawberry', priceModifier: 0, sortOrder: 2 },
          { name: 'Caramel', priceModifier: 0, sortOrder: 3 },
        ],
      },
    },
  ],
};

// 10 tables, 44 seats — matches the venue's stated capacity of ~45.
// No QR token: the Table model has no qrToken field until
// specs/draft/qr-ordering.md lands (that spec extends this seed).
const TABLE_CAPACITIES = [4, 4, 4, 4, 4, 4, 6, 6, 6, 2];

const ALLERGEN_NAMES = ['Gluten', 'Dairy', 'Nuts', 'Eggs', 'Soy', 'Shellfish', 'Fish', 'Sesame'];

async function seedAdminUser(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists — password unchanged.`);
    return;
  }
  const password = randomBytes(9).toString('base64url');
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(password, 10),
      name: 'Gold Rush Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log(`Admin login: ${ADMIN_EMAIL} / ${password}`);
  console.log('(Password shown once — store it now and change it after first login.)');
}

async function seedLocation(prisma: PrismaClient): Promise<string> {
  const location = await prisma.location.upsert({
    where: { slug: 'coolgardie' },
    update: {},
    create: {
      name: 'Coolgardie Gold Rush Motel',
      slug: 'coolgardie',
      description:
        'Licensed restaurant at the Coolgardie Gold Rush Motel — home-style cooked meals and daily specials in the heart of the Goldfields',
      phone: '08 9026 6080',
      email: ADMIN_EMAIL,
      address: '49-53 Bayley Street',
      city: 'Coolgardie',
      state: 'WA',
      postalCode: '6429',
      country: 'AU',
      lat: -30.9536,
      lng: 121.1656,
      deliveryEnabled: false,
      pickupEnabled: true,
      pickupLeadTime: 20,
    },
  });

  // Dinner 5:30–7:30 PM, seven nights.
  for (let day = 0; day <= 6; day++) {
    await prisma.operatingHour.upsert({
      where: { locationId_dayOfWeek: { locationId: location.id, dayOfWeek: day } },
      update: {},
      create: {
        locationId: location.id,
        dayOfWeek: day,
        openTime: '17:30',
        closeTime: '19:30',
        isClosed: false,
      },
    });
  }

  for (let i = 0; i < TABLE_CAPACITIES.length; i++) {
    await prisma.table.upsert({
      where: { locationId_name: { locationId: location.id, name: `Table ${i + 1}` } },
      update: {},
      create: {
        locationId: location.id,
        name: `Table ${i + 1}`,
        capacity: TABLE_CAPACITIES[i],
      },
    });
  }

  return location.id;
}

async function seedDinnerMealtime(prisma: PrismaClient, locationId: string): Promise<string> {
  // Mealtime has no unique key — guard with findFirst so re-seeding doesn't duplicate.
  const existing = await prisma.mealtime.findFirst({ where: { name: 'Dinner', locationId } });
  if (existing) return existing.id;
  const dinner = await prisma.mealtime.create({
    data: {
      name: 'Dinner',
      startTime: '17:30',
      endTime: '19:30',
      days: [0, 1, 2, 3, 4, 5, 6],
      locationId,
    },
  });
  return dinner.id;
}

async function seedMenu(prisma: PrismaClient, locationId: string, dinnerId: string): Promise<void> {
  const allergens = await Promise.all(
    ALLERGEN_NAMES.map((name) => prisma.allergen.upsert({ where: { name }, update: {}, create: { name } }))
  );
  const allergenIdByName = Object.fromEntries(allergens.map((a) => [a.name, a.id]));

  const allergenRows: Array<{ menuItemId: string; allergenId: string }> = [];
  const mealtimeRows: Array<{ menuItemId: string; mealtimeId: string }> = [];

  for (let c = 0; c < menu.length; c++) {
    const categoryData = menu[c];
    const category = await prisma.category.upsert({
      where: { slug: categoryData.slug },
      update: {},
      create: { name: categoryData.name, slug: categoryData.slug, sortOrder: c + 1, locationId },
    });

    for (let i = 0; i < categoryData.items.length; i++) {
      const itemData = categoryData.items[i];
      const item = await prisma.menuItem.upsert({
        where: { slug: itemData.slug },
        update: {},
        create: {
          name: itemData.name,
          slug: itemData.slug,
          description: itemData.description ?? null,
          price: itemData.price,
          categoryId: category.id,
          locationId,
          sortOrder: i + 1,
        },
      });

      const optionGroups = optionsBySlug[itemData.slug];
      if (optionGroups) {
        const optionCount = await prisma.menuOption.count({ where: { menuItemId: item.id } });
        if (optionCount === 0) {
          for (let o = 0; o < optionGroups.length; o++) {
            await prisma.menuOption.create({
              data: { menuItemId: item.id, sortOrder: o + 1, ...optionGroups[o] },
            });
          }
        }
      }

      for (const allergenName of itemData.allergens ?? []) {
        allergenRows.push({ menuItemId: item.id, allergenId: allergenIdByName[allergenName] });
      }
      mealtimeRows.push({ menuItemId: item.id, mealtimeId: dinnerId });
    }
  }

  await prisma.menuItemAllergen.createMany({ data: allergenRows, skipDuplicates: true });
  await prisma.menuItemMealtime.createMany({ data: mealtimeRows, skipDuplicates: true });
}

export async function seedCoolgardie(prisma: PrismaClient): Promise<void> {
  console.log('Seeding Coolgardie Gold Rush Motel...');

  await seedAdminUser(prisma);

  // Full-overwrite update (unlike the demo seed's `update: {}`) so venue
  // branding wins even on a previously seeded database.
  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    update: coolgardieSettings,
    create: { id: 'default', ...coolgardieSettings },
  });

  const locationId = await seedLocation(prisma);
  const dinnerId = await seedDinnerMealtime(prisma, locationId);
  await seedMenu(prisma, locationId, dinnerId);

  const itemCount = await prisma.menuItem.count({ where: { locationId } });
  console.log(`Coolgardie seed complete — ${itemCount} menu items across ${menu.length} categories.`);
}

// CLI entry — only runs when executed directly (tsx prisma/seed-coolgardie.ts),
// not when seedCoolgardie is imported by tests. import.meta is unavailable in
// this CJS-default repo, so the guard checks argv instead.
if (process.argv[1]?.includes('seed-coolgardie')) {
  const prisma = new PrismaClient();
  seedCoolgardie(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
