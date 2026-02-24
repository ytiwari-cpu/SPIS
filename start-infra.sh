#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SPIS Infrastructure Startup Script
# ═══════════════════════════════════════════════════════════════
#
# Starts all infrastructure services:
#   1. Redis (Docker container with persistent AOF)
#   2. Keycloak (Docker container with SHARED Supabase PostgreSQL)
#
# ARCHITECTURE:
#   Developer A's PC              Developer B's PC
#   ┌─────────────────┐          ┌─────────────────┐
#   │ Keycloak (Docker)│          │ Keycloak (Docker)│
#   └────────┬────────┘          └────────┬────────┘
#            │  JDBC (IPv4)               │  JDBC (IPv4)
#            └───────────┬────────────────┘
#                        ↓
#        ┌───────────────────────────────────┐
#        │   Supabase Connection Pooler       │
#        │   (aws-1-ap-northeast-1, IPv4)     │
#        └───────────────┬───────────────────┘
#                        ↓
#        ┌───────────────────────────────────┐
#        │     Supabase IAM PostgreSQL        │
#        │  schema: public   → app tables     │
#        │  schema: keycloak → KC tables      │
#        └───────────────────────────────────┘
#
# All developers share the SAME Keycloak data automatically.
# No sync scripts. No manual imports. Instant shared state.
#
# USAGE:
#   bash start-infra.sh
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Supabase Connection Pooler (IPv4 gateway to IPv6-only database) ──
POOLER_HOST="aws-1-ap-northeast-1.pooler.supabase.com"
POOLER_PORT=5432
POOLER_USER="postgres.wrxrstmncezssrscrkxs"
POOLER_PASS='Argus@12131'
KC_DB_SCHEMA="keycloak"

echo "🚀 Starting SPIS Infrastructure..."
echo ""

# ── Prerequisites Check ──────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# ── Redis ─────────────────────────────────────────────────────────
echo "📦 Starting Redis..."
docker start spis-redis 2>/dev/null || docker run -d \
  --name spis-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes

# ── Keycloak (shared Supabase PostgreSQL via Connection Pooler) ───
echo ""
echo "🔐 Starting Keycloak (shared Supabase backend)..."
docker start spis-keycloak 2>/dev/null || docker run -d \
  --name spis-keycloak \
  --restart unless-stopped \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HTTP_ENABLED=true \
  -e KC_HOSTNAME_STRICT=false \
  -e KC_HOSTNAME_STRICT_HTTPS=false \
  -e KC_HEALTH_ENABLED=true \
  -e KC_DB=postgres \
  -e KC_DB_URL="jdbc:postgresql://${POOLER_HOST}:${POOLER_PORT}/postgres" \
  -e KC_DB_USERNAME="${POOLER_USER}" \
  -e KC_DB_PASSWORD="${POOLER_PASS}" \
  -e KC_DB_SCHEMA="${KC_DB_SCHEMA}" \
  quay.io/keycloak/keycloak:24.0 \
  start-dev

echo ""
echo "⏳ Waiting for Keycloak..."
echo "   (first boot creates ~100 DB tables in Supabase — may take 5-10 min)"
echo "   (subsequent starts: ~30-60s)"
KC_READY=false
for i in $(seq 1 150); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health/ready 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ Keycloak ready (took ~$((i * 5))s)"
    KC_READY=true
    break
  fi
  printf "  ⏳ Waiting... %d/750s\r" $((i * 5))
  sleep 5
done

if [ "$KC_READY" = "false" ]; then
  echo ""
  echo "  ⚠️  Keycloak not ready after 750s — check: docker logs spis-keycloak"
  echo "     Skipping realm setup."
  echo ""
else
  # ── Configure Keycloak Realm (idempotent) ─────────────────────────
  echo ""
  echo "⚙️  Initializing Keycloak realm & clients (idempotent)..."
  set -a; source "${SCRIPT_DIR}/backend/.env" 2>/dev/null; set +a
  cd "${SCRIPT_DIR}/backend/iam-service"
  node setup-keycloak.mjs 2>&1 | grep -E "✅|ℹ️|❌|COMPLETE|already|realm"
  cd - > /dev/null
  echo "  ✅ Realm ready — all developers share the same Keycloak data automatically"
fi

# ── Health Checks ─────────────────────────────────────────────────
echo ""
echo "🏥 Health Checks:"
echo -n "  Redis: "
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ READY"
else
    echo "⚠️  Not responding (may need redis-cli installed)"
fi

echo -n "  Keycloak: "
if curl -sf http://localhost:8080/health/ready > /dev/null 2>&1; then
    echo "✅ READY (shared Supabase backend)"
else
    echo "⚠️  Starting... (may take 60-90s on first boot)"
fi

# ── Summary ───────────────────────────────────────────────────────
echo ""
echo "📋 Service URLs:"
echo "  • Keycloak Admin: http://localhost:8080/admin (admin/admin)"
echo "  • Redis: localhost:6379"
echo ""
echo "🏗️  Architecture:"
echo "  • Keycloak: shared Supabase PostgreSQL (via Connection Pooler, IPv4)"
echo "  • IAM DB: Supabase — shared across all developers"
echo "  • Schema: 'public' = app tables, 'keycloak' = Keycloak tables"
echo "  • No sync needed — all data is instantly shared"
echo ""
echo "📚 Next steps — start services (6 terminals):"
echo "  cd backend/email-service && npm run dev"
echo "  cd backend/email-service && npm run worker"
echo "  cd backend/iam-service && npm run dev"
echo "  cd backend/iam-service && npm run worker"
echo "  cd backend/family-service && npm run dev"
echo "  cd frontend && npm run dev"
echo ""
