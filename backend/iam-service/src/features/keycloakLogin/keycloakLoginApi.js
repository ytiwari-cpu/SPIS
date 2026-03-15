/**
 * IAM — Keycloak Login API
 *
 * Routes:
 *   POST /iam/keycloak/login       — authenticate via Keycloak ROPC
 *   GET  /iam/keycloak/login/jwks-info — JWKS endpoint info (debug)
 *
 * Public endpoints — no auth/permission required.
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { KeycloakLoginController } from './keycloakLoginController.js'

// ── Inline Zod schemas ──────────────────────────────────────

export const KeycloakLoginSchema = z.object({
  national_id: z.string().min(1, 'National ID is required').max(50),
  password:    z.string().min(1, 'Password is required').max(72),
})

// ── Endpoints ───────────────────────────────────────────────

const login = {
  path:    '/',
  verb:    'POST',
  handler: { controller: KeycloakLoginController, method: 'login', arguments: ['request:body'] },
  request: { body: KeycloakLoginSchema },
}

const jwksInfo = {
  path:    '/jwks-info',
  verb:    'GET',
  handler: { controller: KeycloakLoginController, method: 'jwksInfo', arguments: [] },
}

export const KeycloakLoginApi = new ApiSchema({
  name:      'KeycloakLogin',
  url:       '/iam/keycloak/login',
  endpoints: [login, jwksInfo],
})
