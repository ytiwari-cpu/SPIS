# Troubleshooting Guide

## Password Reset Failure (`INTERNAL_ERROR` / `fetch failed`)

### Symptom
When attempting to reset a password, the system returns:
```json
{ "code": "INTERNAL_ERROR", "message": "Password reset failed. Please try again." }
```
Logs in `iam-service` show:
```
{"message":"Fetching new Keycloak admin token"}
{"message":"Failed to set password in Keycloak","error":"fetch failed"}
```

### Cause
The `fetch failed` error indicates that the IAM service cannot connect to the Keycloak server at `http://localhost:8080`. This typically happens if the Keycloak Docker container is stopped or was never started.

### Solution

1. **Start Keycloak Infrastructure**
   Ensure the Keycloak container is running. You can use the project's start script or run it manually:
   ```bash
   docker run -d \
     --name spis-keycloak \
     --restart unless-stopped \
     -p 8080:8080 \
     -e KEYCLOAK_ADMIN=admin \
     -e KEYCLOAK_ADMIN_PASSWORD=admin \
     -e KC_HEALTH_ENABLED=true \
     -e KC_DB=dev-mem \
     -e KC_HTTP_ENABLED=true \
     -e KC_HOSTNAME_STRICT=false \
     -e KC_HOSTNAME_STRICT_HTTPS=false \
     -v keycloak-data:/opt/keycloak/data \
     quay.io/keycloak/keycloak:24.0 \
     start-dev
   ```

2. **Initialize Realm and Clients**
   Wait about 30 seconds for Keycloak to start, then run the setup script to create the `spis-dev` realm and required OIDC clients:
   ```bash
   cd backend/iam-service && node setup-keycloak.mjs
   ```

3. **Verify the Fix**
   Test the password reset request endpoint. A `404` or `User not found` response confirms that the IAM service successfully connected to Keycloak (unlike the previous `500 fetch failed`):
   ```bash
   curl -s -X POST http://localhost:3003/iam/password-reset/request \
     -H "Content-Type: application/json" \
     -d '{"national_id": "ANY_ID"}'
   ```
