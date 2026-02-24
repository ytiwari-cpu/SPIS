#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# SPIS - Start All Services
# ═══════════════════════════════════════════════════════════════
#
# USAGE (for any developer, fresh clone or existing):
#   ./start-all.sh         ← starts everything
#   ./stop-all.sh          ← stops everything
#   cd frontend && npm run dev   ← start frontend separately
#
# What this script does:
#   1. Starts Redis + Keycloak (shared Supabase backend) via start-infra.sh
#   2. Starts all 4 backend services + email worker in background
#   3. Tails all logs in one view
#
# NOTE: First-ever run (fresh machine, no keycloak schema in Supabase yet)
#   takes ~10 minutes for Keycloak to create its DB tables.
#   Every subsequent run takes ~60-90s for Keycloak to boot.
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p logs

echo "🚀 Starting SPIS — full stack"
echo ""

# ── Step 1: Infrastructure (Redis + Keycloak) ─────────────────
echo "══════════════════════════════════════════════════════"
echo "  STEP 1/2 — Infrastructure (Redis + Keycloak)"
echo "══════════════════════════════════════════════════════"
bash start-infra.sh
echo ""

# ── Step 2: Backend Services ──────────────────────────────────
echo "══════════════════════════════════════════════════════"
echo "  STEP 2/2 — Backend Services"
echo "══════════════════════════════════════════════════════"

# Family Service (3001)
echo "📦 Starting Family Service (port 3001)..."
cd "$SCRIPT_DIR/backend/family-service"
npm run dev < /dev/null > "$SCRIPT_DIR/logs/family-service.log" 2>&1 &
FAMILY_PID=$!

sleep 1

# Email Service (3002)
echo "📧 Starting Email Service (port 3002)..."
cd "$SCRIPT_DIR/backend/email-service"
npm run dev < /dev/null > "$SCRIPT_DIR/logs/email-service.log" 2>&1 &
EMAIL_PID=$!

sleep 1

# Email Worker
echo "⚙️  Starting Email Worker..."
cd "$SCRIPT_DIR/backend/email-service"
npm run worker:dev < /dev/null > "$SCRIPT_DIR/logs/email-worker.log" 2>&1 &
WORKER_PID=$!

sleep 1

# IAM Service (3003)
echo "🔐 Starting IAM Service (port 3003)..."
cd "$SCRIPT_DIR/backend/iam-service"
npm run dev < /dev/null > "$SCRIPT_DIR/logs/iam-service.log" 2>&1 &
IAM_PID=$!

sleep 1

# Programme Service (3004)
echo "📋 Starting Programme Service (port 3004)..."
cd "$SCRIPT_DIR/backend/programme-service"
npm run dev < /dev/null > "$SCRIPT_DIR/logs/programme-service.log" 2>&1 &
PROGRAMME_PID=$!

cd "$SCRIPT_DIR"

sleep 3

# ── Save PIDs ─────────────────────────────────────────────────
echo "$FAMILY_PID"    > logs/pids.txt
echo "$EMAIL_PID"    >> logs/pids.txt
echo "$IAM_PID"      >> logs/pids.txt
echo "$PROGRAMME_PID" >> logs/pids.txt
echo "$WORKER_PID"   >> logs/pids.txt

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ SPIS fully started!"
echo "══════════════════════════════════════════════════════"
echo ""
echo "📋 Services:"
echo "   Keycloak Admin:     http://localhost:8080/admin    (admin / admin)"
echo "   IAM Service:        http://localhost:3003"
echo "   Family Service:     http://localhost:3001"
echo "   Email Service:      http://localhost:3002"
echo "   Programme Service:  http://localhost:3004"
echo ""
echo "🖥️  Frontend:"
echo "   cd frontend && npm run dev    → http://localhost:3000"
echo ""
echo "📝 All backend logs: ./logs/"
echo "🛑 To stop everything: ./stop-all.sh"
echo ""
echo "─────────────────── Live Logs ────────────────────────"
tail -f logs/iam-service.log logs/family-service.log logs/email-service.log logs/programme-service.log
