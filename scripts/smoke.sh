#!/usr/bin/env bash
# Smoke test for the local Docker dev stack.
# Run after `docker compose up --build -d` once the server is healthy:
#   ./scripts/smoke.sh
# Each check exits non-zero on failure.
set -euo pipefail

API="${API:-http://localhost:3000}"
STOREFRONT="${STOREFRONT:-http://localhost:5174}"
ADMIN="${ADMIN:-http://localhost:5173}"
QR_TOKEN="${QR_TOKEN:-dev-table-1-qr}"

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }

echo "Smoke-testing KitchenAsty dev stack..."

# 1. Server health
curl -fsS "$API/api/health" >/dev/null && pass "server health ($API/api/health)" \
  || fail "server health"

# 2. Storefront served
curl -fsS "$STOREFRONT/" >/dev/null && pass "storefront reachable ($STOREFRONT)" \
  || fail "storefront reachable"

# 3. Admin served
curl -fsS "$ADMIN/" >/dev/null && pass "admin reachable ($ADMIN)" \
  || fail "admin reachable"

# 4. Seed applied — menu has items
curl -fsS "$API/api/menu" | grep -q '"id"' && pass "seeded menu returned items" \
  || fail "seeded menu empty (is the migrate/seed step done?)"

# 5. Dine-in QR token resolves (seeded dev-table-1-qr)
curl -fsS "$API/api/locations/tables/by-token/$QR_TOKEN" | grep -q '"tableName"' && pass "QR token resolves ($QR_TOKEN)" \
  || fail "QR token '$QR_TOKEN' did not resolve"

echo "All smoke checks passed."
