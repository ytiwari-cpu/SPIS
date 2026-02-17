#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# SPIS - Start All Services
# ═══════════════════════════════════════════════════════════════

cd "$(dirname "$0")"

echo "🚀 Starting SPIS Services..."
echo ""

# Start Keycloak (Port 8080)
echo "🔑 Starting Keycloak on port 8080..."
if docker ps --format '{{.Names}}' | grep -q spis-keycloak; then
    echo "   Keycloak already running"
else
    docker-compose -f docker-compose.keycloak.yml up -d 2>/dev/null || \
    docker compose -f docker-compose.keycloak.yml up -d 2>/dev/null
    echo "   Waiting for Keycloak to start..."
    sleep 10
fi
echo ""

# Start Family Service (Port 3001)
echo "📦 Starting Family Service on port 3001..."
cd backend/family-service
npm run dev > ../../logs/family-service.log 2>&1 &
FAMILY_PID=$!
cd ../..

sleep 2

# Start Email Service (Port 3002)
echo "📧 Starting Email Service on port 3002..."
cd backend/email-service
npm run dev > ../../logs/email-service.log 2>&1 &
EMAIL_PID=$!
cd ../..

sleep 2

# Start IAM Service (Port 3003)
echo "🔐 Starting IAM Service on port 3003..."
cd backend/iam-service
npm run dev > ../../logs/iam-service.log 2>&1 &
IAM_PID=$!
cd ../..

sleep 2

# Start Email Worker
echo "⚙️  Starting Email Worker..."
cd backend/email-service
npm run worker:dev > ../../logs/email-worker.log 2>&1 &
WORKER_PID=$!
cd ../..

sleep 3

echo ""
echo "✅ All backend services started!"
echo ""
echo "📊 Service Status:"
echo "   Keycloak:        http://localhost:8080 (Docker: spis-keycloak)"
echo "   Family Service:  http://localhost:3001 (PID: $FAMILY_PID)"
echo "   Email Service:   http://localhost:3002 (PID: $EMAIL_PID)"
echo "   IAM Service:     http://localhost:3003 (PID: $IAM_PID)"
echo "   Email Worker:    Background (PID: $WORKER_PID)"
echo ""
echo "📝 Logs are in ./logs/ directory"
echo ""
echo "🛑 To stop all services, run: ./stop-all.sh"
echo ""

# Save PIDs to file for stopping later
echo "$FAMILY_PID" > logs/pids.txt
echo "$EMAIL_PID" >> logs/pids.txt
echo "$IAM_PID" >> logs/pids.txt
echo "$WORKER_PID" >> logs/pids.txt

echo "Press Ctrl+C to view logs (services will continue running in background)"
echo ""
tail -f logs/*.log
