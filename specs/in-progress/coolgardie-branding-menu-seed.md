# Coolgardie Gold Rush Motel Branding & Menu Seed

## Status: In Progress

<!-- Status values: Draft | In Progress | Complete | On Hold | Cancelled -->
<!-- Folder must match status: draft/ | in-progress/ | completed/ | on-hold/ | cancelled/ -->

## Objective

Seed the platform with the real branding, settings, location, and full menu of the Coolgardie Gold Rush Motel restaurant (sourced from https://www.coolgardiegoldrushmotel.com.au/restaurant-coolgardie and its June 2025 menu PDF), so the storefront presents the actual venue instead of the fictional "Saffron & Sage" demo.

## Problem Statement

1. **Demo-only seed data** — `prisma/seed.ts` seeds a fictional San Francisco Mediterranean restaurant ("Saffron & Sage", `prisma/seed.ts:55`, `prisma/seed.ts:591`) with USD pricing, US address, and Unsplash imagery. The deployment target is the Coolgardie Gold Rush Motel in WA, Australia.
2. **No venue-specific seed path** — the only seed entry point is `packages/server/package.json:20` (`"seed": "tsx ../../prisma/seed.ts"`). There is no way to provision a production-ready Coolgardie database without hand-entering ~41 menu items, settings, and hours through the admin UI.
3. **Upstream constraint** — this repo is a fork of `mighty840/kitchenasty` intended to contribute back upstream. Replacing the generic demo seed with venue data would create a permanent divergence; the venue data must live alongside the demo seed, not in place of it.

## Current Architecture

The Prisma schema lives at the repo root (`prisma/schema.prisma`); `packages/server` points at it via its `prisma` config block. `npm run db:seed -w packages/server` runs `prisma db seed`, which executes `tsx ../../prisma/seed.ts`.

`prisma/seed.ts` is a single `main()` that upserts (keyed on unique slugs/ids, with guards for models lacking unique keys): admin + customer users, allergens, a `Location` with `OperatingHour`s, `DeliveryZone`s, `Mealtime`s, `Category`s, `MenuItem`s with `MenuOption`/`MenuOptionValue`, allergen/mealtime join rows, `Table`s, coupons, sample orders/reviews/reservation, `SiteSettings` (id `"default"`), legal pages, cookie categories, and gallery images.

Branding is entirely data-driven: `SiteSettings` (`prisma/schema.prisma:581`) carries `siteName`, `siteTitle`, `logo`, `colorPrimary`, `colorSecondary`, `storefrontTemplate`, and JSON blobs for `heroSection`, `featuresSection`, `ctaSection`, plus operational groups (`generalSettings` with currency/timezone/contact, `orderSettings`, `reservationSettings`). The storefront reads these through the settings API (`packages/server/src/controllers/settings.controller.ts`; Zod group schemas at lines 171–202) and renders one of ten templates registered in `packages/storefront/src/templates/index.ts` (valid ids include `rustic`).

### Key Files

| File | Role |
|------|------|
| `prisma/seed.ts` | Existing demo seed (Saffron & Sage) — stays untouched |
| `prisma/schema.prisma` | `SiteSettings` (line 581), `Location`, `Category` (188), `MenuItem` (212), `MenuOption` (246), `MenuItemAllergen` (319), `MenuItemMealtime` (300) |
| `packages/server/package.json` | `prisma.seed` wiring and `db:seed` script |
| `packages/server/src/controllers/settings.controller.ts` | Zod schemas defining valid shapes for `generalSettings` / `orderSettings` / `reservationSettings` |
| `packages/storefront/src/templates/index.ts` | Valid `storefrontTemplate` ids (`rustic` chosen) |
| `packages/docs/configuration/database.md` | Documents seeding — needs the new command |

## Design

### Source data (captured 2026-07-03)

- **Website**: name "Coolgardie Gold Rush Motel" (licensed restaurant, "hidden gem", home-style cooked meals, daily specials, seasonal menu, capacity 45, takeout available, functions/birthdays/meetings). Hours Mon–Sun 5:30 PM–7:30 PM. Phone 08 9026 6080, email admin@coolgardiegoldrushmotel.com.au, 49-53 Bayley Street, Coolgardie WA 6429.
- **Logo**: cartoon gold prospector (brown hat, gold plaid shirt, red trousers, shovel) — `https://lirp.cdn-website.com/8c29b248/dms3rep/multi/opt/1-1Uo9IhJHB-transformed-removebg-preview+%281%29-1920w.png`. Palette derived from it: gold `#d4a017` (primary), saddle brown `#7c4a21` (secondary).
- **Menu**: extracted from `Coolgardie_Gold_Rush_Motels-Menu_June_2025.pdf` (2 pages) — full item list reproduced in the Menu data section below.

### Standalone venue seed, additive to the repo

A new `prisma/seed-coolgardie.ts` exports `seedCoolgardie(prisma: PrismaClient): Promise<void>` plus a CLI entry (same `main()`/`$disconnect` pattern as `prisma/seed.ts`). It is wired as a new script — the default `db:seed` and `prisma.seed` config keep pointing at the demo seed:

```jsonc
// packages/server/package.json (scripts)
"db:seed": "prisma db seed",
"db:seed:coolgardie": "tsx ../../prisma/seed-coolgardie.ts",
```

The seed is idempotent (upsert-by-slug / guarded creates, mirroring `prisma/seed.ts` conventions) and intended for a **fresh database**. It can technically run after the demo seed — all slugs are disjoint — but then two locations coexist; the `SiteSettings` upsert uses a **full `update` payload** (unlike the demo's `update: {}`) so Coolgardie branding always wins.

It seeds no sample orders, reviews, reservations, coupons, or gallery images — this is production provisioning, not demo data. Admin user (`admin@coolgardiegoldrushmotel.com.au`, seed password logged to console) is created; no sample customer.

### Branding & settings

```ts
await prisma.siteSettings.upsert({
  where: { id: 'default' },
  update: coolgardieSettings,          // full overwrite — venue branding wins
  create: { id: 'default', ...coolgardieSettings },
});

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
    subtitle: 'A hidden gem in Coolgardie — home-style cooked meals, daily specials, and warm hospitality at our fully licensed restaurant.',
    backgroundImage: '', // admin uploads venue photo later
    ctaPrimaryText: 'View Our Menu', ctaPrimaryLink: '/menu',
    ctaSecondaryText: 'Book a Table', ctaSecondaryLink: '/reservations',
  },
  featuresSection: [
    { icon: '🍽️', title: 'Home-Style Meals', description: 'Hearty home-style cooked meals and daily specials, with a seasonal menu for diverse dietary needs' },
    { icon: '🍺', title: 'Fully Licensed', description: 'Relax with a drink from our licensed bar — open for dinner 7 nights a week' },
    { icon: '🎉', title: 'Functions & Events', description: 'Seating for 45 guests — birthdays, meetings, and functions welcome' },
  ],
  ctaSection: {
    title: 'Dinner Tonight at the Gold Rush?',
    description: 'Join us any night from 5:30pm — dine in, take away, or book a table for your group.',
    buttonText: 'Order Now', buttonLink: '/menu',
  },
  generalSettings: {
    timezone: 'Australia/Perth', distanceUnit: 'km',
    defaultCurrency: 'AUD', currencySymbol: '$', currencyPosition: 'before',
    contactEmail: 'admin@coolgardiegoldrushmotel.com.au', contactPhone: '08 9026 6080',
  },
  orderSettings: { enabled: true, enableTipping: false, taxRate: 0 }, // AU prices are GST-inclusive; dineInEnabled belongs to specs/draft/qr-ordering.md (not yet in orderSettingsSchema)
  reservationSettings: { enabled: true, autoConfirm: false },
};
```

All group values conform to the Zod schemas in `settings.controller.ts:171-202` (`generalSettingsSchema`, `orderSettingsSchema`, `reservationSettingsSchema`).

### Location, hours, mealtime, tables

- `Location` slug `coolgardie`: name "Coolgardie Gold Rush Motel", address 49-53 Bayley Street, Coolgardie WA 6429, AU; phone/email as above; lat `-30.9536`, lng `121.1656` (approximate — Bayley St, Coolgardie); `deliveryEnabled: false`, `pickupEnabled: true` (takeout offered, no delivery advertised), `pickupLeadTime: 20`.
- `OperatingHour` Mon–Sun `17:30`–`19:30` (site: 5:30–7:30 PM daily).
- One `Mealtime` "Dinner" `17:30`–`19:30`, days `[0..6]`, linked to every menu item.
- 10 `Table`s (6×4-seat, 3×6-seat, 1×2-seat — 44 seats, matching the venue's stated capacity of ~45). No QR token is seeded — the `Table` model has no `qrToken` field yet; `specs/draft/qr-ordering.md` adds it (and `dev-table-1-qr` seeding) when it lands, and must update this seed alongside the demo seed.
- No `DeliveryZone`s.

### Menu data (verbatim from June 2025 PDF)

Nine categories (sortOrder in PDF order): Starters, Seafood, Burgers, Mains, Pasta, Vegetarian, Sauces, Kids, Dessert — slugs `starters`, `seafood`, `burgers`, `mains`, `pasta`, `vegetarian`, `sauces`, `kids`, `dessert` (all disjoint from demo slugs).

| Category | Item | Price (AUD) | Description / notes |
|---|---|---|---|
| Starters | Garlic & Herb Bread | 12 | 2 slices per serve |
| Starters | Cheesy Garlic & Herb Bread | 14 | 2 slices per serve |
| Starters | Soup of the Day | 15 | |
| Starters | Asian Plate | 15 | Mini dim sims & spring rolls served with sweet chilli sauce |
| Starters | Chicken Garlic Balls | 14 | Served with a light coating of garlic sauce |
| Starters | Wedges | 14 | Served with sour cream and sweet chilli sauce |
| Starters | Prawn Twisters | 15 | Served with sweet chilli sauce |
| Seafood | Salt & Pepper Squid | 32 | Served with a garden salad, chips and tartare sauce |
| Seafood | Prawns (GF) | 35 | Lightly sautéed with garlic sauce, served with a garden salad and chips |
| Seafood | Beer Battered Flathead | 30 | Served with a garden salad, chips and tartare sauce |
| Seafood | Seafood Basket | 28 | Served with a garden salad, chips and tartare sauce |
| Seafood | Grilled Salmon | 35 | Served on a bed of mash potato and vegetables |
| Burgers | Hamburger with the Lot | 26 | Bacon, onion, egg, cheese, tomato and lettuce |
| Burgers | Gold Rush Steak Burger | 28 | Tender sirloin steak with bacon, onion, cheese, tomato, lettuce, BBQ sauce in a toasted Turkish roll, served with a side of chips |
| Mains | Grilled Sirloin Steak (GF) | 40 | Choice of sides; add 4 garlic prawns +$12 |
| Mains | BBQ Pork Ribs (GF) | 37 | Tennessee BBQ style marinade and rub, served with coleslaw, charred corn and chips |
| Mains | Braised Lamb Shank | 36 | Cooked in a classic rich red wine sauce seasoned with rosemary, served with mash |
| Mains | Rissoles | 27 | Homemade rissoles with mash, vegetables and onion gravy |
| Mains | Bangers & Mash | 27 | Sausages with mash, vegetables and onion gravy |
| Mains | Chicken Parmigiana | 30 | Crumbed chicken breast topped with napoleon sauce, ham and cheese; choice of sides |
| Mains | Chicken Schnitzel | 27 | Crumbed chicken breast; choice of sides |
| Mains | Chicken Kiev | 25 | Golden crumbed chicken filled with garlic sauce; choice of sides |
| Mains | Buffalo Wings | 25 | 5 crumbed chicken wings; choice of sides and choice of garlic or sweet chilli sauce |
| Pasta | Pasta Carbonara | 30 | Linguine tossed through a creamy garlic sauce with bacon, egg, mushrooms and parmesan cheese |
| Pasta | Spaghetti Bolognaise | 30 | Traditional bolognaise served on linguine, topped with parmesan cheese |
| Vegetarian | Vegetarian Stirfry | 25 | |
| Vegetarian | Veggie Burger | 25 | Onion, egg, cheese, tomato and lettuce |
| Sauces | Pepper Sauce | 6 | |
| Sauces | Mushroom Sauce | 6 | |
| Sauces | Creamy Garlic Sauce | 6 | |
| Sauces | Gravy | 6 | |
| Kids | Kids Fish 'n' Chips | 15 | Includes a free ice cream |
| Kids | Kids Chicken Schnitzel & Chips | 15 | Includes a free ice cream |
| Kids | Kids Nuggets & Chips | 15 | Includes a free ice cream |
| Kids | Kids Spaghetti Bolognaise | 15 | Includes a free ice cream |
| Dessert | Sticky Date Pudding | 15 | Served with ice cream |
| Dessert | Apple Crumble | 15 | Served with ice cream |
| Dessert | Chocolate Bavarian | 15 | |
| Dessert | Mango & Peach Cheesecake | 15 | |
| Dessert | Ice Cream Sundae | 12 | |
| Dessert | Ice Cream | 8 | Choice of chocolate, strawberry or caramel topping |

41 items. The PDF cross-lists Pasta Carbonara and Soup of the Day under Vegetarian; `MenuItem.slug` is unique so each item is seeded once, in its primary category. No item images are seeded (`image` left null; admin uploads real photos later — the demo's Unsplash placeholders would misrepresent the venue's food).

### Menu options

| Item(s) | Option | Type | Values |
|---|---|---|---|
| Grilled Sirloin Steak, Chicken Parmigiana, Chicken Schnitzel, Chicken Kiev, Buffalo Wings | Sides | RADIO, required | Chips & Salad (default, +0), Mash & Vegetables (+0) |
| Grilled Sirloin Steak | Add Garlic Prawns | CHECKBOX | 4 Garlic Prawns (+12) |
| Grilled Sirloin Steak | Add a Sauce | CHECKBOX, maxSelect 2 | Pepper (+6), Mushroom (+6), Creamy Garlic (+6), Gravy (+6) |
| Buffalo Wings | Sauce | RADIO, required | Garlic Sauce (default, +0), Sweet Chilli Sauce (+0) |
| Ice Cream | Topping | RADIO, required | Chocolate (default, +0), Strawberry (+0), Caramel (+0) |

Options are guarded with a per-item `menuOption.count()` check so re-seeding doesn't duplicate. (The demo seed lacks this guard — its `menuOption.create` calls duplicate on re-run; the venue seed does not copy that bug.)

### Allergens

The 8 standard allergens are upserted (same list as the demo seed). Only unambiguous associations are tagged — e.g. Gluten on breads/battered/crumbed/pasta/burgers/desserts with pastry, Shellfish on prawn/squid/seafood-basket items, Fish on flathead/salmon/fish 'n' chips, Dairy on cheese/cream dishes and desserts, Eggs on carbonara and egg-topped burgers. Items marked (GF) on the menu get no Gluten tag. The exact mapping is finalized in implementation; nothing speculative is tagged.

### Alternatives Considered

- **Replacing `prisma/seed.ts`** — rejected: the fork contributes back upstream, and the demo seed doubles as e2e/dev fixture data.
- **Committing the logo into the repo / media library** — deferred (Out of Scope): hotlinking the venue CDN works today and avoids checking a ~1.1 MB binary into the shared fork; revisit when real food photography is added.

## Implementation Order

### Phase 1: Seed scaffold, branding, location
<!-- packages: server -->

- [x] **T1.1** Create `prisma/seed-coolgardie.ts` with exported `seedCoolgardie(prisma)` + CLI entry (`main()`, error handling, `$disconnect`), seeding the admin user `[server]` `[~50 LOC]`
- [x] **T1.2** Seed `SiteSettings` upsert with full-overwrite `update` payload (branding, hero/features/CTA, general/order/reservation settings) `[server]` `[~80 LOC]` — depends: T1.1
- [x] **T1.3** Seed `Location` (slug `coolgardie`), operating hours 17:30–19:30 daily, Dinner mealtime, 10 tables (~45 seats; no QR token — schema has no `qrToken` field until qr-ordering lands) `[server]` `[~60 LOC]` — depends: T1.1
- [x] **T1.4** Add `db:seed:coolgardie` script to `packages/server/package.json` `[server]` `[~2 LOC]`

(T1.2, T1.3, T1.4 are parallelisable after T1.1.)

> **Session notes (2026-07-03)**: `prisma/seed-coolgardie.ts` created with `seedCoolgardie(prisma)` split into `seedAdminUser`/`seedLocation`/`seedDinnerMealtime`/`seedMenu` helpers. CLI entry guarded by `process.argv[1]?.includes('seed-coolgardie')` — the repo is CJS-default so `import.meta` guards are unavailable, and the guard keeps the CLI from firing when tests import the module. Admin password is randomly generated (`randomBytes(9).toString('base64url')`) and logged once on create; existing admin left untouched on re-run. `Mealtime` has no unique key → guarded via `findFirst`. `db:seed:coolgardie` script added to `packages/server/package.json`.

### Phase 2: Menu data
<!-- depends: Seed scaffold, branding, location | packages: server -->

- [x] **T2.1** Seed 9 categories with PDF sort order `[server]` `[~45 LOC]`
- [x] **T2.2** Seed menu items for Starters, Seafood, Burgers, and Mains (23 items; names, slugs, descriptions, prices per the table above; no images) `[server]` `[~150 LOC]` — depends: T2.1
- [x] **T2.3** Seed menu items for Pasta, Vegetarian, Sauces, Kids, and Dessert (18 items) `[server]` `[~110 LOC]` — depends: T2.1
- [x] **T2.4** Seed menu options (Sides on 5 mains, garlic prawns + sauce add-ons on steak, wings sauce, ice-cream topping) with count-guards `[server]` `[~80 LOC]` — depends: T2.2, T2.3
- [x] **T2.5** Seed allergens + unambiguous `MenuItemAllergen` rows and `MenuItemMealtime` rows (all items → Dinner) `[server]` `[~50 LOC]` — depends: T2.2, T2.3

(T2.2 and T2.3 are parallelisable after T2.1; T2.4 and T2.5 are parallelisable after both.)

> **Session notes (2026-07-03)**: Menu is data-driven — a `menu: SeedCategory[]` constant (9 categories, 41 items, verbatim from the table above) walked by `seedMenu()`; options live in `optionsBySlug: Record<string, SeedOption[]>` with a shared `SIDES_OPTION` reused across the 5 choice-of-sides mains, guarded by per-item `menuOption.count()`. **Slug deviation**: the venue's Grilled Salmon uses `grilled-salmon-gold-rush` because the demo seed already owns the globally-unique `grilled-salmon` (the "all slugs disjoint" claim above missed this); every other slug is as planned. Allergen tagging follows the Allergens section; ambiguous cases (squid batter, chicken garlic balls, mushroom sauce cream, kiev butter) left untagged. Verified: 41 unique item slugs, 0 overlapping with `prisma/seed.ts`.

### Phase 3: Verification and docs
<!-- depends: Menu data | packages: server, docs -->

- [x] **T3.1** Integration test `packages/server/src/__tests__/integration/seed-coolgardie.test.ts` (see Testing Strategy) `[server]` `[~60 LOC]` — depends: T2.4, T2.5
- [x] **T3.2** Document `db:seed:coolgardie` in `packages/docs/configuration/database.md`; add CHANGELOG entry `[docs]` `[~15 LOC]`

> **Session notes (2026-07-03)**: Test written TDD-first (failed on unresolved import before the seed existed), then extended per `test-auditor` findings: option-group content (steak/wings/ice-cream), Dinner mealtime links (41), tables (10/44 seats), allergen spot checks (Shellfish on prawn twisters, none on (GF) steak), admin user, per-category counts, `grilled-salmon-gold-rush` collision guard, and a location-scoped idempotency snapshot across 8 row kinds. **No live-DB run in this environment** (no Docker daemon access, no local PostgreSQL): the suite collects and skips (16 skipped) without `DATABASE_URL`; all 325 pre-existing server tests still pass; server `tsc --noEmit` and an ad-hoc strict typecheck of the seed are clean. A demo+venue coexistence test was not added — `prisma/seed.ts` runs `main()` as an un-awaitable import side effect and stays untouched per spec; coexistence is covered by the disjoint-slug check and the salmon slug assertion. `npm run lint` is broken repo-wide (no ESLint config exists — pre-existing); drafted `specs/draft/repair-eslint-config.md`. Docs: venue-seed section added to `packages/docs/configuration/database.md` (VitePress build green) and CHANGELOG `[Unreleased]` entry added per T3.2 (finalize should not duplicate it).

## Testing Strategy

### Unit Tests

None — the seed is pure data provisioning; there is no logic to unit-test in isolation from the database.

### Integration / E2E Tests

| Test File | What It Tests |
|-----------|--------------|
| `packages/server/src/__tests__/integration/seed-coolgardie.test.ts` | Imports `seedCoolgardie` and runs it against a real PostgreSQL DB. Unlike the existing integration tests (which mock `lib/db.js` via `vi.mock` and never touch PostgreSQL), this one needs the real data layer, so it is gated with `describe.skipIf(!process.env.DATABASE_URL)` — it skips cleanly where no DB is configured and runs when `DATABASE_URL` points at a migrated database. Asserts: `SiteSettings.siteName === 'Coolgardie Gold Rush Motel'`, `storefrontTemplate === 'rustic'`, `generalSettings.defaultCurrency === 'AUD'`; location slug `coolgardie` exists with 7 operating hours and `deliveryEnabled === false`; 9 categories and 41 menu items for that location; Grilled Sirloin Steak has 3 options; **idempotency** — running `seedCoolgardie` a second time leaves category/item/option counts unchanged. |

Manual verification during `/wf:develop`: run `npm run db:seed:coolgardie -w packages/server` against the local Docker dev DB and load the storefront to confirm the rustic template renders with venue branding and the full menu.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Menu PDF is dated June 2025 — prices/items may have changed by now | Seed exactly what's published; flag to the venue for confirmation before go-live. All items editable in admin afterwards. |
| Hotlinked logo URL (`lirp.cdn-website.com`) breaks if the venue rebuilds their website | Logo is a single `SiteSettings.logo` field — replace via admin media upload; committing the asset is noted in Out of Scope. |
| Running the venue seed on a DB that already has demo data leaves two locations | Documented as fresh-DB-first; `SiteSettings` full-overwrite ensures branding is correct regardless; slugs are disjoint so no collisions. |
| Importing `prisma/seed-coolgardie.ts` (outside `packages/server/src`) into a Vitest integration test may trip TS `rootDir`/include boundaries | Vitest transforms imports independently of `tsc` project boundaries; if `tsc --noEmit` complains, exclude the test's import path via type-only assertion or add the file to the server tsconfig `include` — resolve in T3.1. |
| lat/lng are approximate (geocoded from address) | Only used for distance/maps display; delivery is disabled so nothing functional depends on precision. |
| GST handling — `taxRate: 0` assumes menu prices are GST-inclusive | Standard AU retail practice; venue's accountant can adjust `taxRate` in admin if itemized GST is wanted. |

## Out of Scope

- Downloading/committing the logo or any food photography into the repo or media library (admin uploads post-deploy; revisit as its own task when the venue supplies photos).
- Menu item images — seeded null, populated later via admin.
- Any storefront template/code changes — branding is achieved purely with existing `SiteSettings` fields and the existing `rustic` template.
- Accommodation/rooms content from the motel website — this platform covers the restaurant only.
- QR table tokens and `orderSettings.dineInEnabled` — the schema/settings fields don't exist yet; `specs/draft/qr-ordering.md` owns them and must extend this seed (Table 1 token, dine-in flag) when it lands.
- Payments configuration (Stripe/Pinch) — covered by `specs/draft/pinch-payments-provider.md`.
- Modifying or removing the demo seed `prisma/seed.ts`.
- Real table/floor-plan layout for the 45-seat room — generic 10-table split for now.
- Localization of venue copy (site is English-only).

## Files to Change

| File | Change |
|------|--------|
| `prisma/seed-coolgardie.ts` | **NEW** — venue seed: `seedCoolgardie()` export + CLI entry |
| `packages/server/package.json` | Add `db:seed:coolgardie` script |
| `packages/server/src/__tests__/integration/seed-coolgardie.test.ts` | **NEW** — integration test per Testing Strategy |
| `packages/docs/configuration/database.md` | Document the venue seed command alongside `db:seed` |
| `CHANGELOG.md` | Added: Coolgardie Gold Rush Motel venue seed |

## Documentation Impact

- [x] `packages/docs/configuration/database.md` — add `db:seed:coolgardie` next to the existing seeding docs (fresh-DB usage note)
- [x] `CHANGELOG.md` — `### Added` entry under Unreleased
