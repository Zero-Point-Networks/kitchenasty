# 🗄️ Database

KitchenAsty uses **PostgreSQL 16** with **Prisma ORM** for schema management, migrations, and queries.

## 🔌 Connection

Set the connection string in your `.env`:

```dotenv
DATABASE_URL=postgresql://user:password@host:5432/kitchenasty
```

## 📐 Prisma Schema

The schema lives at `prisma/schema.prisma` in the repository root. It defines 20+ models across domains like users, menu, orders, payments, reservations, and more.

See [Database Schema](/architecture/database-schema) for the full model reference.

## 🔄 Migrations

### 🆕 Generate a migration after schema changes

```bash
npx -w packages/server prisma migrate dev --schema ../../prisma/schema.prisma --name describe_your_change
```

### 🚀 Deploy migrations in production

```bash
npx -w packages/server prisma migrate deploy --schema ../../prisma/schema.prisma
```

### ⚡ Push schema without migrations (development)

```bash
npx -w packages/server prisma db push --schema ../../prisma/schema.prisma
```

## 🌱 Seeding

The seed script at `prisma/seed.ts` creates:

- 👤 A Super Admin user (`admin@kitchenasty.com` / `admin123`)
- 📍 A sample location with operating hours
- 🍽️ Menu categories and items with options
- 🪑 Tables for reservations
- ⚠️ Sample allergens

Run the seed:

```bash
npx tsx prisma/seed.ts
```

### 🏨 Venue seed: Coolgardie Gold Rush Motel

A production-provisioning seed at `prisma/seed-coolgardie.ts` sets up the real Coolgardie Gold Rush Motel venue instead of the fictional demo restaurant:

- 🎨 Site branding (name, logo, gold/brown palette, `rustic` storefront template) — the `SiteSettings` upsert **fully overwrites** existing branding so the venue always wins
- 👤 A Super Admin (`admin@coolgardiegoldrushmotel.com.au`, random password printed once to the console)
- 📍 The Coolgardie location (pickup only, dinner hours 5:30–7:30 PM daily) with 10 tables and a Dinner mealtime
- 📱 Dine-in QR ordering enabled, with a **random QR token per table** (printable from **Locations → Tables**; reseeding never rotates existing tokens, so printed codes stay valid)
- 🍽️ The full 41-item menu (9 categories) with options and allergen tags — no sample orders, reviews, coupons, or gallery images
- 🖼️ Generated placeholder menu images copied from `prisma/seed-assets/coolgardie-menu/` into `uploads/coolgardie-menu/`

Run it against a **fresh, migrated database**:

```bash
npm run db:seed:coolgardie -w packages/server
```

It is idempotent — re-running updates branding, refreshes generated placeholder image files in the runtime uploads directory, and leaves seeded rows unchanged. It can technically run alongside the demo seed (slugs are disjoint), but two locations will then coexist; prefer a fresh database for a venue deployment.

The generated menu images are staging placeholders only. Replace them with venue-owned food photography through the admin menu image upload flow before go-live.

## 🔍 Prisma Studio

Browse and edit data with the built-in GUI:

```bash
npx -w packages/server prisma studio --schema ../../prisma/schema.prisma
```

Opens at http://localhost:5555.

## 🗑️ Reset

Drop all data and re-run migrations + seed:

```bash
npx -w packages/server prisma migrate reset --schema ../../prisma/schema.prisma
```

::: warning
This permanently deletes all data. Only use in development.
:::
