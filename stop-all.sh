#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# SPIS - Stop All Services
# ═══════════════════════════════════════════════════════════════

cd "$(dirname "$0")"

echo "🛑 Stopping SPIS Services..."
echo ""

# Stop Keycloak Docker container
if docker ps --format '{{.Names}}' | grep -q spis-keycloak; then
    echo "   Stopping Keycloak (Docker)..."
    docker stop spis-keycloak 2>/dev/null
    echo "   ✅ Keycloak stopped"
fi
echo ""

if [ -f logs/pids.txt ]; then
    while read pid; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "   Stopping process $pid..."
            kill $pid 2>/dev/null
        fi
    done < logs/pids.txt
    rm logs/pids.txt
    echo ""
    echo "✅ All services stopped!"
else
    echo "⚠️  No PID file found. Attempting to kill by port..."
    echo ""
    
    # Kill by port
    lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "   Stopped family-service (3001)"
    lsof -ti:3002 | xargs kill -9 2>/dev/null && echo "   Stopped email-service (3002)"
    lsof -ti:3003 | xargs kill -9 2>/dev/null && echo "   Stopped iam-service (3003)"
    lsof -ti:3004 | xargs kill -9 2>/dev/null && echo "   Stopped programme-service (3004)"
    pkill -f "worker:dev" 2>/dev/null && echo "   Stopped email worker"
    
    echo ""
    echo "✅ Services stopped!"
fi

echo ""
