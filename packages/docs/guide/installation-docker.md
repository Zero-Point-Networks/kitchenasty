# 🐳 Install with Docker

The fastest way to get KitchenAsty running. Docker Compose starts the API server, admin dashboard, storefront, and PostgreSQL in one command.

## 1. 📥 Clone the Repository

```bash
git clone https://github.com/kitchenasty/kitchenasty.git
cd kitchenasty
```

## 2. ⚙️ Configure Environment (optional)

The stack runs with sensible defaults out of the box — no configuration required. To override, copy the root `.env.example` to `.env` (Docker Compose loads it automatically):

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_PASSWORD` | `kitchenasty` | Database password |
| `JWT_SECRET` | `change-this-to-a-random-secret` | API token signing secret |
| `PUBLIC_URL` | `http://localhost:5174` | Storefront origin; **dine-in QR codes point here** |

> **Scanning QR codes from a phone?** Set `PUBLIC_URL` to your machine's LAN origin (e.g. `http://192.168.1.50:5174`) so generated QR codes resolve on the device.

See [Environment Variables](/configuration/environment-variables) for the full reference.

## 3. 🚀 Start Services

```bash
docker compose up --build      # or: npm run docker:dev
```

Migrations and the demo seed run **automatically** on startup via a one-shot `migrate` service — the API server waits for it to finish before booting. No manual DB setup needed. (The seed is idempotent, so it's safe to re-run `up`.)

This starts:

| Service | URL |
|---------|-----|
| API Server | http://localhost:3000 |
| Admin Dashboard | http://localhost:5173 |
| Storefront | http://localhost:5174 |
| Docs | http://localhost:5175 |
| PostgreSQL | localhost:5432 |

## 4. ✅ Verify (smoke test)

Once the server is healthy, confirm the stack end-to-end:

```bash
./scripts/smoke.sh
```

It checks server health, the storefront/admin pages, that the menu is seeded, and that the demo dine-in QR token (`dev-table-1-qr`) resolves.

## 5. ✅ Access the Platform

### 🛠️ Admin Dashboard

- URL: http://localhost:5173
- Email: `admin@kitchenasty.com`
- Password: `admin123`

### 🛍️ Storefront

- URL: http://localhost:5174
- Register a new customer account or browse as a guest

### 📖 API Documentation

- Swagger UI: http://localhost:3000/api/docs
- OpenAPI spec: http://localhost:3000/api/openapi.json

## 🛑 Stopping

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```

## 🔄 Rebuilding

After pulling changes:

```bash
docker compose up --build
```

## 🔍 Troubleshooting

### 🚧 Port conflicts

If ports 3000, 5173, 5174, or 5432 are in use, edit `docker-compose.yml` and change the host port mappings (left side of the colon).

### 🔌 Database connection refused

The server waits for PostgreSQL to be healthy before starting. If you still see connection errors, check that the `DATABASE_URL` in your `.env` uses `postgres` (the Docker service name) as the host, not `localhost`.
