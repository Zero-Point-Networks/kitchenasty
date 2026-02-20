<p align="center">
  <a href="https://github.com/mighty840/kitchenasty">
    <img src="assets/logo.svg" alt="KitchenAsty Logo" width="420" />
  </a>
</p>

<h1 align="center">KitchenAsty</h1>

<p align="center">
  <em>Self-hosted restaurant ordering, reservations, and management — all in one platform.</em>
</p>

<p align="center">
  <a href="https://github.com/mighty840/kitchenasty/actions/workflows/ci.yml"><img src="https://github.com/mighty840/kitchenasty/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white" alt="Node.js" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-blue?logo=docker&logoColor=white" alt="Docker" /></a>
</p>

<p align="center">
  <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white" alt="Express" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white" alt="Prisma" /></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white" alt="Socket.IO" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="https://playwright.dev/"><img src="https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white" alt="Playwright" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="https://github.com/mighty840/kitchenasty/issues/new?template=bug_report.md">Report Bug</a> &middot;
  <a href="https://github.com/mighty840/kitchenasty/issues/new?template=feature_request.md">Request Feature</a>
</p>

---

KitchenAsty enables restaurants, cafes, and takeaways to accept online orders for delivery and pickup, manage menus, handle table reservations, and run day-to-day operations from a single admin panel. Built as a modern TypeScript monorepo with separate admin and storefront frontends, a REST API with real-time WebSocket updates, and a full test suite with 330+ tests.

---

## Features

### Ordering & Payments

- Online ordering with delivery/pickup, scheduling, and guest checkout
- Stripe payment integration with webhooks, plus cash-on-delivery
- Real-time order tracking with visual progress and Socket.IO updates
- Kitchen display — live Kanban board with one-click status progression
- Coupon system with percentage, fixed, and free-delivery discount types

### Menu & Kitchen

- Category management with nesting and menu item CRUD
- Options, allergens, and mealtime tagging per item
- Image uploads (JPEG/PNG/WebP/GIF, 5 MB max) with preview
- Stock tracking with automatic availability updates

### Reservations & Reviews

- Customer booking with time-slot availability checking
- Admin reservation workflow: pending, confirmed, seated, completed
- Table assignment with capacity tracking and reservation protection
- Customer reviews (1-5 stars) with admin moderation (approve/reject)

### Analytics & Automation

- Dashboard with real-time metrics: orders, revenue, reservations, customers
- Interactive charts: revenue trends, daily orders, hourly patterns, category breakdown
- Branded HTML email notifications for order and reservation confirmations
- API docs via Swagger UI at `/api/docs`

### Internationalization

- i18n with react-i18next and language switcher
- English, Spanish, French, German, Italian, and Portuguese translations

### Developer Experience

- TypeScript strict mode across the entire monorepo
- Vitest unit/integration + Playwright E2E (330+ tests)
- GitHub Actions CI: lint, test, audit, build, and artifact packaging
- Docker Compose for local PostgreSQL, npm workspaces for monorepo

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) |
| **Frontend (Admin)** | [React 18](https://react.dev/) + [Vite](https://vite.dev/) |
| **Frontend (Storefront)** | [React 18](https://react.dev/) + [Vite](https://vite.dev/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) |
| **Auth** | JWT ([jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)) + [bcrypt](https://github.com/dcodeIO/bcrypt.js) |
| **Validation** | [Zod](https://zod.dev/) |
| **Real-time** | [Socket.IO](https://socket.io/) |
| **Charts** | [Recharts](https://recharts.org/) |
| **File Upload** | [Multer](https://github.com/expressjs/multer) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Testing** | [Vitest](https://vitest.dev/) + [Supertest](https://github.com/ladjs/supertest) + [Playwright](https://playwright.dev/) |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (strict mode) |

---

## Quick Start

### Prerequisites

- **Node.js** 22+ &nbsp;|&nbsp; **Docker** (for PostgreSQL) &nbsp;|&nbsp; **npm** 10+

### 1. Clone & install

```bash
git clone git@github.com:mighty840/kitchenasty.git
cd kitchenasty
npm install
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Set up environment & migrate

```bash
cp packages/server/.env.example packages/server/.env
npx -w packages/server prisma migrate dev --schema ../../prisma/schema.prisma
npx -w packages/server prisma db seed
```

### 4. Start development servers

```bash
npm run dev:server      # API server → http://localhost:3000
npm run dev:admin       # Admin panel → http://localhost:5173
npm run dev:storefront  # Storefront  → http://localhost:5174
```

---

## Project Structure

```
kitchenasty/
├── .github/workflows/     # CI pipeline
├── assets/                # Logo and brand assets
├── e2e/                   # Playwright E2E tests
│   ├── admin/             #   Admin panel tests
│   └── storefront/        #   Customer storefront tests
├── packages/
│   ├── admin/             # React admin panel (Vite, port 5173)
│   ├── docs/              # VitePress documentation site
│   ├── server/            # Express API server (port 3000)
│   ├── shared/            # Shared types and constants
│   └── storefront/        # React customer storefront (Vite, port 5174)
├── prisma/
│   ├── schema.prisma      # Database schema (20 models)
│   └── seed.ts            # Sample data seeder
├── docker-compose.yml     # PostgreSQL for local dev
├── playwright.config.ts   # E2E test configuration
└── PLAN.md                # Full feature roadmap
```

---

## Documentation

Full API reference (endpoints, request/response schemas), database schema diagrams, and CI pipeline details are available in the **[docs site](packages/docs/)**.

Interactive Swagger UI is served at [`/api/docs`](http://localhost:3000/api/docs) when the server is running.

---

## Contributing

1. Fork the repository and create a feature branch from `main`
2. Make changes and add tests
3. Ensure all tests pass: `npm test && npm run test:e2e`
4. Push and open a pull request

See [`PLAN.md`](PLAN.md) for the full roadmap and feature ideas.

---

## License

[MIT](https://opensource.org/licenses/MIT)
