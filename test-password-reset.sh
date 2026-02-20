#!/bin/bash

# Quick test script for password reset flow

echo "================================="
echo "Password Reset Flow - Quick Test"
echo "================================="
echo ""

# Check services
echo "1. Checking services..."
echo "   IAM Service (3003): $(curl -s http://localhost:3003/healthz | grep -o 'ok' || echo 'NOT RUNNING')"
echo "   Email Service (3002): $(curl -s http://localhost:3002/healthz | grep -o 'ok' || echo 'NOT RUNNING')"
echo "   Frontend (3000): $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000)"
echo ""

# Test with a National ID
echo "2. Testing password reset request..."
read -p "   Enter National ID (14 digits): " NATIONAL_ID

if [ -z "$NATIONAL_ID" ]; then
    echo "   ❌ National ID required"
    exit 1
fi

echo ""
echo "   Sending OTP request..."
RESPONSE=$(curl -s -X POST http://localhost:3003/iam/password-reset/request \
  -H "Content-Type: application/json" \
  -d "{\"national_id\":\"$NATIONAL_ID\"}")

echo "   Response: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ OTP sent successfully!"
    echo "   📧 Check your email for the OTP code"
    echo ""
    echo "3. Now open your browser:"
    echo "   → http://localhost:3000/reset-password"
    echo "   → Enter the same National ID: $NATIONAL_ID"
    echo "   → Enter the OTP from your email"
    echo "   → Create your new password"
else
    echo "   ❌ Failed to send OTP"
    ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"')
    echo "   Error: $ERROR"
    echo ""
    echo "   Possible issues:"
    echo "   - National ID not found in Registry"
    echo "   - No email registered for this National ID"
    echo "   - Registry service not available"
fi
