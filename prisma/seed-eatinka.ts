import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Moksha restaurant centre in Schwenningen.
const CENTRE: [number, number] = [48.060, 8.540];

/**
 * Generate a regular polygon that approximates a true geographic circle of
 * `radiusMeters` around `centre`. We use 64 vertices — visually
 * indistinguishable from a circle at typical zoom levels, and still cheap to
 * run point-in-polygon on.
 *
 * Earth curvature is ignored — fine for catchments under ~50 km.
 */
function circle(centre: [number, number], radiusMeters: number, segments = 64): [number, number][] {
  const [lat, lng] = centre;
  const latRad = (lat * Math.PI) / 180;
  // ~111,111 metres per degree of latitude; longitude shrinks with cos(lat).
  const dLatPerM = 1 / 111_111;
  const dLngPerM = 1 / (111_111 * Math.cos(latRad));
  const out: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const dLat = Math.cos(theta) * radiusMeters * dLatPerM;
    const dLng = Math.sin(theta) * radiusMeters * dLngPerM;
    out.push([lat + dLat, lng + dLng]);
  }
  return out;
}

async function main() {
  console.log('[eatinka] seeding Eat Inka demo data');

  // Location -----------------------------------------------------------------
  const location = await prisma.location.upsert({
    where: { slug: 'moksha-schwenningen' },
    update: {},
    create: {
      slug: 'moksha-schwenningen',
      name: 'Moksha — Schwenningen',
      description: 'Authentic Indian kitchen powering Inka corporate lunch deliveries.',
      address: 'Bürkstraße 4',
      city: 'Villingen-Schwenningen',
      state: 'BW',
      postalCode: '78054',
      country: 'DE',
      phone: '+49 7720 0000000',
      email: 'hello@eatinka.de',
      lat: CENTRE[0],
      lng: CENTRE[1],
      deliveryEnabled: true,
      pickupEnabled: true,
      minOrderDelivery: 12,
      minOrderPickup: 0,
      deliveryLeadTime: 60,
      pickupLeadTime: 30,
    },
  });

  // Deactivate any other locations, categories, and menu items so the
  // storefront only surfaces Eat Inka content. Items keep their data (in case
  // we want to restore KitchenAsty seed later) but stop appearing in the UI.
  await prisma.location.updateMany({
    where: { NOT: { id: location.id } },
    data: { isActive: false },
  });
  await prisma.category.updateMany({
    where: { NOT: { slug: { startsWith: 'eatinka-' } } },
    data: { isActive: false },
  });
  await prisma.menuItem.updateMany({
    where: { NOT: { slug: { startsWith: 'eatinka-' } } },
    data: { isActive: false },
  });

  // Operating hours (Mon–Fri lunch service)
  const lunchDays = [1, 2, 3, 4, 5];
  for (const dow of [0, 1, 2, 3, 4, 5, 6]) {
    await prisma.operatingHour.upsert({
      where: { locationId_dayOfWeek: { locationId: location.id, dayOfWeek: dow } },
      update: {},
      create: {
        locationId: location.id,
        dayOfWeek: dow,
        openTime: '11:30',
        closeTime: '14:00',
        isClosed: !lunchDays.includes(dow),
      },
    });
  }

  // Delivery zones -----------------------------------------------------------
  // Concentric rectangles around Moksha. `charge` ascending means the inner
  // zone matches first in the order controller.
  const zones = [
    {
      name: '1 Schwenningen Mitte',
      boundaries: circle(CENTRE, 1500), // ~1.5 km radius
      charge: 0,
      minOrder: 12,
      cutoffTime: '20:00',
      etaMinutes: 20,
    },
    {
      name: '2 Villingen & Suburbs',
      boundaries: circle(CENTRE, 5000), // 5 km radius
      charge: 1.5,
      minOrder: 18,
      cutoffTime: '19:00',
      etaMinutes: 30,
    },
    {
      name: '3 Wider Region',
      boundaries: circle(CENTRE, 12000), // 12 km radius
      charge: 3.5,
      minOrder: 25,
      cutoffTime: '17:00',
      etaMinutes: 45,
    },
  ];

  for (const z of zones) {
    const existing = await prisma.deliveryZone.findFirst({
      where: { locationId: location.id, name: z.name },
    });
    if (existing) {
      await prisma.deliveryZone.update({
        where: { id: existing.id },
        data: {
          boundaries: z.boundaries,
          charge: z.charge,
          minOrder: z.minOrder,
          cutoffTime: z.cutoffTime,
          etaMinutes: z.etaMinutes,
          isActive: true,
        },
      });
    } else {
      await prisma.deliveryZone.create({
        data: {
          locationId: location.id,
          name: z.name,
          boundaries: z.boundaries,
          charge: z.charge,
          minOrder: z.minOrder,
          cutoffTime: z.cutoffTime,
          etaMinutes: z.etaMinutes,
        },
      });
    }
  }

  // Categories ---------------------------------------------------------------
  const categories = [
    { slug: 'eatinka-curries', name: 'Curries', sortOrder: 1 },
    { slug: 'eatinka-rice-breads', name: 'Rice & Breads', sortOrder: 2 },
    { slug: 'eatinka-sides', name: 'Sides', sortOrder: 3 },
    { slug: 'eatinka-drinks', name: 'Drinks', sortOrder: 4 },
  ];
  const catBySlug: Record<string, string> = {};
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder, locationId: location.id, isActive: true },
      create: { ...c, locationId: location.id },
    });
    catBySlug[c.slug] = cat.id;
  }

  // Allergens — the EU-mandated 14 allergens that need to appear on menus.
  // We upsert by unique name so re-running the seed is idempotent.
  const allergens = [
    'Gluten',
    'Dairy',
    'Eggs',
    'Nuts',
    'Peanuts',
    'Soy',
    'Mustard',
    'Sesame',
    'Celery',
    'Sulphites',
  ];
  const allergenIds: Record<string, string> = {};
  for (const name of allergens) {
    const a = await prisma.allergen.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    allergenIds[name] = a.id;
  }

  // Menu items ---------------------------------------------------------------
  const img = (name: string) => `/uploads/eatinka/${name}`;
  type Diet = 'veg' | 'vegan' | undefined;
  const items: Array<{
    slug: string;
    name: string;
    price: number;
    image: string;
    categorySlug: string;
    description: string;
    diet?: Diet;
    allergens: string[];
  }> = [
    { slug: 'eatinka-butter-chicken', name: 'Butter Chicken', price: 11.5, image: img('pexels-pixabay-277253.jpg'), categorySlug: 'eatinka-curries', description: 'Tandoor-grilled chicken in a silky tomato-cashew gravy.', allergens: ['Dairy', 'Nuts'] },
    { slug: 'eatinka-tikka-masala', name: 'Chicken Tikka Masala', price: 11.9, image: img('pexels-enginakyurt-1438672.jpg'), categorySlug: 'eatinka-curries', description: 'Char-grilled chicken pieces simmered in a spiced masala.', allergens: ['Dairy'] },
    { slug: 'eatinka-rogan-josh', name: 'Lamb Rogan Josh', price: 13.5, image: img('pexels-fotios-photos-1351238.jpg'), categorySlug: 'eatinka-curries', description: 'Slow-cooked lamb with Kashmiri chilies and aromatics.', allergens: [] },
    { slug: 'eatinka-paneer-masala', name: 'Paneer Tikka Masala', price: 10.9, image: img('pexels-ella-olsson-572949-1640777.jpg'), categorySlug: 'eatinka-curries', description: 'Grilled cottage cheese in a rich, spiced masala.', diet: 'veg', allergens: ['Dairy'] },
    { slug: 'eatinka-dal-tadka', name: 'Dal Tadka', price: 8.9, image: img('pexels-mareefe-678414.jpg'), categorySlug: 'eatinka-curries', description: 'Yellow lentils tempered with cumin and garlic.', diet: 'vegan', allergens: [] },
    { slug: 'eatinka-chana-masala', name: 'Chana Masala', price: 8.5, image: img('pexels-janetrangdoan-1092730.jpg'), categorySlug: 'eatinka-curries', description: 'Chickpeas in a spiced tomato-onion gravy.', diet: 'vegan', allergens: [] },
    { slug: 'eatinka-basmati', name: 'Basmati Rice', price: 3.5, image: img('pexels-jang-699953.jpg'), categorySlug: 'eatinka-rice-breads', description: 'Fragrant long-grain rice, steamed to perfection.', diet: 'vegan', allergens: [] },
    { slug: 'eatinka-garlic-naan', name: 'Garlic Naan', price: 3.5, image: img('pexels-thepaintedsquare-606540.jpg'), categorySlug: 'eatinka-rice-breads', description: 'Tandoor-baked flatbread brushed with garlic butter.', diet: 'veg', allergens: ['Gluten', 'Dairy'] },
    { slug: 'eatinka-plain-naan', name: 'Plain Naan', price: 2.9, image: img('pexels-valeriya-842571.jpg'), categorySlug: 'eatinka-rice-breads', description: 'Soft, pillowy tandoor flatbread.', diet: 'veg', allergens: ['Gluten', 'Dairy'] },
    { slug: 'eatinka-samosa', name: 'Samosa (2 pcs)', price: 4.5, image: img('pexels-robinstickel-70497.jpg'), categorySlug: 'eatinka-sides', description: 'Crisp pastry parcels with spiced potato and peas.', diet: 'vegan', allergens: ['Gluten', 'Mustard'] },
    { slug: 'eatinka-mango-lassi', name: 'Mango Lassi', price: 3.9, image: img('pexels-vanmalidate-784631.jpg'), categorySlug: 'eatinka-drinks', description: 'Sweet yogurt drink with ripe mango.', diet: 'veg', allergens: ['Dairy'] },
    { slug: 'eatinka-masala-chai', name: 'Masala Chai', price: 2.5, image: img('pexels-elevate-1267320.jpg'), categorySlug: 'eatinka-drinks', description: 'Black tea spiced with cardamom and ginger.', diet: 'veg', allergens: ['Dairy'] },
  ];

  let order = 1;
  for (const it of items) {
    const menuItem = await prisma.menuItem.upsert({
      where: { slug: it.slug },
      update: {
        name: it.name,
        price: it.price,
        image: it.image,
        description: it.description,
        categoryId: catBySlug[it.categorySlug],
        locationId: location.id,
        sortOrder: order,
        isActive: true,
      },
      create: {
        slug: it.slug,
        name: it.name,
        price: it.price,
        image: it.image,
        description: it.description,
        categoryId: catBySlug[it.categorySlug],
        locationId: location.id,
        sortOrder: order,
      },
    });

    // Reset and re-write allergen links for idempotent re-seeding.
    await prisma.menuItemAllergen.deleteMany({ where: { menuItemId: menuItem.id } });
    for (const aName of it.allergens) {
      const aId = allergenIds[aName];
      if (!aId) continue;
      await prisma.menuItemAllergen.create({
        data: { menuItemId: menuItem.id, allergenId: aId },
      });
    }
    order += 1;
  }

  // Site settings ------------------------------------------------------------
  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    update: {
      siteName: 'Inka',
      siteTitle: "Inka — Tomorrow's Lunch, Delivered",
      storefrontTemplate: 'elegant',
      colorPrimary: '#c2410c',
      colorSecondary: '#15803d',
      logo: '/uploads/eatinka/InkaLogo.jpg',
      darkMode: 'light',
      heroSection: {
        title: 'Tomorrow’s Lunch, Sorted',
        subtitle: 'Authentic Indian dishes from Moksha, delivered to your desk. Order by 8 PM, lunch lands by noon.',
        backgroundImage: '/uploads/eatinka/pexels-fotios-photos-1351238.jpg',
        ctaPrimaryText: 'Order Tomorrow’s Lunch',
        ctaPrimaryLink: '/menu',
        ctaSecondaryText: 'See the catchment',
        ctaSecondaryLink: '/locations',
      },
      featuresSection: [
        { icon: '🕗', title: 'Order by 8 PM', description: 'Lock in tomorrow’s lunch the night before. Per-zone cutoffs visible at a glance.' },
        { icon: '📍', title: 'Smart Geo-fence', description: 'We deliver across Schwenningen and the wider Black Forest region.' },
        { icon: '🍛', title: 'Built for Teams', description: 'Slack-friendly menus, group orders, and a daily-rotating chef’s special coming soon.' },
      ],
      ctaSection: {
        title: 'Hungry for tomorrow?',
        description: 'Pre-order your team’s lunch in under a minute.',
        buttonText: 'Browse the Menu',
        buttonLink: '/menu',
      },
    },
    create: {
      id: 'default',
      siteName: 'Inka',
      siteTitle: "Inka — Tomorrow's Lunch, Delivered",
      storefrontTemplate: 'elegant',
      colorPrimary: '#c2410c',
      colorSecondary: '#15803d',
      logo: '/uploads/eatinka/InkaLogo.jpg',
      darkMode: 'light',
    },
  });

  // -------- demo company: Northwind --------------------------------
  // Email-domain match means anyone registering with @northwind.co
  // lands in this Company with the Mercer St office pre-selected.
  // €8/weekday allowance covers ~1 dish + a side.
  const northwind = await prisma.company.upsert({
    where: { emailDomain: 'northwind.co' },
    update: { name: 'Northwind', allowancePerWeekdayCents: 800 },
    create: { name: 'Northwind', emailDomain: 'northwind.co', allowancePerWeekdayCents: 800 },
  });

  // Office upsert — find an existing one to keep customer relations stable.
  const existingOffice = await prisma.office.findFirst({
    where: { companyId: northwind.id, name: 'Mercer St' },
  });
  const mercerSt = existingOffice
    ? await prisma.office.update({
        where: { id: existingOffice.id },
        data: {
          name: 'Mercer St',
          line1: '14 Mercer St',
          line2: 'Floor 6',
          city: 'Schwenningen',
          postalCode: '78054',
          country: 'DE',
          isDefault: true,
        },
      })
    : await prisma.office.create({
        data: {
          companyId: northwind.id,
          name: 'Mercer St',
          line1: '14 Mercer St',
          line2: 'Floor 6',
          city: 'Schwenningen',
          postalCode: '78054',
          country: 'DE',
          isDefault: true,
        },
      });

  console.log('[eatinka] done.');
  console.log(`[eatinka] location: ${location.id} (${location.slug})`);
  console.log(`[eatinka] menu items: ${items.length}, zones: ${zones.length}`);
  console.log(`[eatinka] company: ${northwind.name} (${northwind.emailDomain}, €${(northwind.allowancePerWeekdayCents/100).toFixed(2)}/day)`);
  console.log(`[eatinka] office: ${mercerSt.name} at ${mercerSt.line1}, ${mercerSt.city}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
