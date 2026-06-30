# Project Profile

Project-specific configuration consumed by workflow commands and agents. This file is the single source of project-specific values — commands reference it instead of hardcoding paths, package names, and tool commands.

Generated/updated by `/wf:bootstrap`. Edit manually if needed.

---

## Project Overview

**KitchenAsty** — Self-hosted restaurant ordering, reservations, and management platform.
- **Tech stack**: TypeScript (ES2022, Node16 modules); Express + Prisma + PostgreSQL backend; React 18 + Vite (admin & storefront); Expo / React Native (mobile); VitePress (docs); Stripe, socket.io, Passport (Google/Facebook OAuth), JWT, Zod, Pino.
- **Domain**: One platform for restaurant online ordering, table reservations, and back-office management, designed to be self-hosted.

## Package Manager & Workspace

- **Package manager**: npm
- **Workspace tool**: npm workspaces (`workspaces: ["packages/*"]`)
- **Monorepo**: yes

| Name | Path | Published Name | Role |
|------|------|----------------|------|
| `@kitchenasty/shared` | `packages/shared/` | — | Shared types and utilities consumed by all other packages |
| `@kitchenasty/server` | `packages/server/` | — | Express REST API, Prisma data layer, Stripe payments, socket.io, auth |
| `@kitchenasty/admin` | `packages/admin/` | — | React + Vite admin dashboard (recharts analytics) |
| `@kitchenasty/storefront` | `packages/storefront/` | — | React + Vite customer storefront with i18next/intlayer localization |
| `@kitchenasty/docs` | `packages/docs/` | — | VitePress documentation site |
| `@kitchenasty/mobile` | `packages/mobile/` | — | Expo / React Native mobile app (zustand, expo-router, Stripe RN) |

**Shared package build order**: `@kitchenasty/shared` must build first — `server`, `admin`, `storefront`, and `mobile` depend on it via the `"*"` workspace protocol.

## Build Commands

| Action | Command | Notes |
|--------|---------|-------|
| Install | `npm install` | Root install hydrates all workspaces |
| Build all | `npm run build` | Builds shared → server → admin → storefront in order |
| Build shared | `npm run build -w packages/shared` | `tsc`; run before dependent packages |
| Build docs | `npm run build:docs` | `vitepress build` (separate from main build) |
| Lint | `npm run lint` | `eslint packages/*/src --ext .ts,.tsx` |
| Lint fix | `npm run lint -- --fix` | No dedicated `lint:fix` script; pass `--fix` |

## Test Commands

Root `npm test` runs unit then integration. E2E is Playwright (`playwright.config.ts` at root; specs in `e2e/`).

| Package | All Tests | Single File | Framework |
|---------|-----------|-------------|-----------|
| `@kitchenasty/shared` | `npm run test -w packages/shared` | `npm run test -w packages/shared -- src/__tests__/index.test.ts` | Vitest |
| `@kitchenasty/server` | `npm run test -w packages/server` | `npm run test -w packages/server -- <path>` | Vitest |
| server (unit only) | `npm run test:unit -w packages/server` | — | Vitest |
| server (integration only) | `npm run test:integration -w packages/server` | — | Vitest |
| e2e (admin + storefront) | `npm run test:e2e` (`npx playwright test`) | `npx playwright test <spec>` | Playwright |

## Test Locations

| Package | Unit Tests | Integration Tests | Helpers |
|---------|-----------|-------------------|---------|
| `@kitchenasty/shared` | `packages/shared/src/__tests__/` | — | — |
| `@kitchenasty/server` | `packages/server/src/__tests__/unit/` | `packages/server/src/__tests__/integration/` | — |
| e2e | — | `e2e/admin/`, `e2e/storefront/` | — |

## Type Check Commands

| Package | Command |
|---------|---------|
| `@kitchenasty/shared` | `tsc --noEmit -p packages/shared` |
| `@kitchenasty/server` | `tsc --noEmit -p packages/server` |
| `@kitchenasty/admin` | `cd packages/admin && tsc -b` |
| `@kitchenasty/storefront` | `cd packages/storefront && tsc -b` |
| `@kitchenasty/mobile` | `npm run typecheck -w packages/mobile` (`tsc --noEmit`) |

## Git Conventions

- **Main branch**: `main`
- **Branch naming**: ❓ no strong pattern detected from history; PRs squash-merged with `(#NN)` suffix
- **Commit style**: Conventional Commits (`feat`, `fix`, `chore`, `docs`) with scope and trailing PR number, e.g. `feat(payment): website Stripe Checkout (#50)`

## Documentation Locations

| Change Type | Documentation Location |
|-------------|----------------------|
| User/feature/API/architecture docs | `packages/docs/` (VitePress; `api/`, `architecture/`, `features/`, `guide/`, `deployment/`, `self-hosting/`, etc.) |
| Project README | `README.md` |
| Contributing guide | `CONTRIBUTING.md` |
| Security policy | `SECURITY.md` |
| Release notes | `CHANGELOG.md` |

## Changelog

- **File**: `CHANGELOG.md`
- **Format**: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + Semantic Versioning; entries grouped under `## [x.y.z] - YYYY-MM-DD` with `### Added/Changed/Fixed` subsections

## Key Constraints & Gotchas

- **Build order**: `@kitchenasty/shared` must build before `server`, `admin`, `storefront`, and `mobile` (they depend on it via the `"*"` workspace protocol). The root `build` script already encodes this order.
- **Prisma**: The Prisma schema lives at the repo root (`prisma/schema.prisma`); `packages/server` points at it via `../../prisma/schema.prisma`. Run `prisma generate` (and `prisma migrate`) before building or testing the server. Seed via `npm run db:seed -w packages/server`.
- **Integration tests need PostgreSQL**: server integration tests under `src/__tests__/integration/` exercise the real data layer and require a running/migrated PostgreSQL database (set `DATABASE_URL`). Unit tests do not.
- **Mobile excluded from root pipeline**: the Expo/React Native `mobile` package is not part of the root `build`, `test`, or `lint` scripts and is built/tested/typechecked separately.

## Coding Standards Memory Files

(none)

## Reference Artifacts

(none)

## Actor Flows

- "A diner browses the storefront menu and places an online order"
- "A diner pays for an order via Stripe Checkout in EUR"
- "A diner reserves a table through the storefront"
- "An admin manages menu items, media, and reservations from the admin dashboard"
- "A mobile app user receives push notifications about their order/reservation"

_(Starter list inferred from features — tune as flows are formalized.)_

## Language Standards

### TypeScript
- **Naming**: PascalCase React components and types; camelCase functions and variables. Server uses dot-suffixed filenames (`order.controller.ts`, `payment.routes.ts`); React pages/components are PascalCase files (`Checkout.tsx`).
- **Forbidden**: `any` (prefer `unknown` or precise types); class components.
- **Required**: explicit return types on exported functions; Zod schemas for external/request input validation on the server; `strict` TypeScript (already enabled in root `tsconfig.json`).
- **Repo convention**: React page/route components use **default exports** (every page in `admin`/`storefront` does, and the routers import them as default) — do not flag default exports on components in this repo. Non-component modules (libs, utils) use named exports.

## Code Quality Metrics

### TypeScript (packages/*/src)
- **Line count**: `find packages/*/src -name '*.ts' -o -name '*.tsx' | grep -v __tests__ | xargs wc -l`
- **`any` count**: `rg '\bany\b' packages/*/src --type ts -c`
- **Type check errors (server)**: `cd packages/server && npx tsc --noEmit 2>&1 | grep -c 'error TS'`
- **Lint issues**: `npm run lint 2>&1 | grep -c 'error'`

## Audit Dimensions

### Security

- **Scope**: `packages/*/src`
- **Agent**: `security-auditor`
- **Inputs**:
  - `npm audit --omit=dev`
  - `rg 'eval\(|new Function\(|innerHTML\s*=' packages/*/src`
  - `rg 'process\.env' packages/server/src -c`
- **Severity mapping**: `npm-audit:critical → critical; npm-audit:high → high`
- **Notes**: Pay attention to auth (Passport/JWT), Stripe webhook signature verification, and IDOR on order/reservation endpoints (see commit #43).

### Architecture

- **Scope**: `packages/*/src`
- **Agent**: `architecture-auditor`
- **Inputs**:
  - `npx madge --circular packages/server/src`
  - `npx madge --circular packages/admin/src`
  - `npx madge --circular packages/storefront/src`
- **Notes**: Verify cross-package imports only flow through `@kitchenasty/shared`; no package should import another app package directly.

### Testing

- **Scope**: `packages/shared/src`, `packages/server/src`
- **Agent**: `test-auditor`
- **Inputs**:
  - `npm run test:unit`
  - `npm run test:integration -w packages/server`
- **Notes**: Integration tests require a migrated PostgreSQL DB. E2E (`npm run test:e2e`) is Playwright and may need running app servers.

### Project Structure

- **Scope**: `packages/*/src`
- **Agent**: `structure-auditor`
- **Inputs**:
  - `find packages/*/src -name '*.ts' -size +12k -o -name '*.tsx' -size +12k`
  - `find . -type d -empty -not -path '*/node_modules/*' -not -path '*/.git/*'`
- **Notes**: ~300 LOC soft threshold for TS files.

### Code Quality

- **Scope**: `packages/*/src`
- **Agent**: `code-reviewer`
- **Inputs**: (none — agent reads `## Language Standards`)

### PRD Conformance

- **Scope**: (none)
- **Agent**: `inline`
- **Inputs**: (none — walks `## Reference Artifacts`)
- **Notes**: No reference artifacts configured; this dimension no-ops until `## Reference Artifacts` is populated.
