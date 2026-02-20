#!/bin/bash

echo "🚀 Starting SPIS Infrastructure..."
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Redis
echo "📦 Starting Redis..."
docker start spis-redis 2>/dev/null || docker run -d \
  --name spis-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes

# Keycloak
echo "🔐 Starting Keycloak..."
docker start spis-keycloak 2>/dev/null || docker run -d \
  --name spis-keycloak \
  --restart unless-stopped \
  -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  -e KC_HEALTH_ENABLED=true \
  -v keycloak-data:/opt/keycloak/data \
  quay.io/keycloak/keycloak:23.0 \
  start-dev

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 20

# Health checks
echo ""
echo "🏥 Health Checks:"
echo -n "  Redis: "
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ READY"
else
    echo "❌ NOT READY"
fi

echo -n "  Keycloak: "
if curl -sf http://localhost:8080/auth/health/ready > /dev/null 2>&1; then
    echo "✅ READY"
else
    echo "⚠️  Starting... (may take 30-60s)"
fi

echo ""
echo "📋 Service URLs:"
echo "  - Keycloak Admin: http://localhost:8080/auth/admin (admin/admin)"
echo "  - RabbitMQ Dashboard: https://customer.cloudamqp.com/instance"
echo "  - Redis: localhost:6379"
echo ""
echo "📚 Next steps:"
echo "  1. Configure Keycloak realm → See INFRASTRUCTURE_SETUP.md"
echo "  2. Run migrations:"
echo "     cd backend/email-service && npm run migrate"
echo "     cd backend/iam-service && npm run migrate"
echo "  3. Start services (6 terminals):"
echo "     cd backend/email-service && npm run dev"
echo "     cd backend/email-service && npm run worker"
echo "     cd backend/iam-service && npm run dev"
echo "     cd backend/iam-service && npm run worker"
echo "     cd backend/family-service && npm run dev"
echo "     cd frontend && npm run dev"
echo ""
