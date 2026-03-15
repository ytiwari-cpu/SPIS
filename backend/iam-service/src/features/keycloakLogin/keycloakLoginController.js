/**
 * KeycloakLoginController — handles /iam/keycloak/login routes
 */

import { BaseController }          from '../../../../base/baseController.js'
import { KeycloakLoginService }    from './keycloakLoginService.js'

export class KeycloakLoginController extends BaseController {
  constructor(context) {
    super(context)
    this.keycloakLoginService = new KeycloakLoginService(context)
  }

  /**
   * POST /iam/keycloak/login
   * Authenticate user via Keycloak ROPC and return RS256 JWT.
   * IP/userAgent extracted in service via this.context.request.
   */
  async login(body) {
    const { national_id, password } = body

    // Clean national_id (digits only)
    const cleanNationalId = national_id.replaceAll(/\D/g, '')

    try {
      const result = await this.keycloakLoginService.loginWithKeycloak({
        nationalId: cleanNationalId,
        password,
      })

      this.respondOk({ success: true, data: result })
    } catch (error) {
      const statusCode = error.statusCode || 500
      const message = error.message || 'Internal server error'

      if (statusCode >= 500) {
        this.log.error('Keycloak login error (5xx)', { error: message })
      } else {
        this.log.warn('Login attempt failed', { statusCode, error: message })
      }

      this.respondJson({
        success: false,
        error:   {
          code: statusCode === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR',
          message,
        },
      }, statusCode)
    }
  }

  /**
   * GET /iam/keycloak/login/jwks-info
   * Returns JWKS endpoint information for debugging.
   */
  async jwksInfo() {
    const keycloakBase = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8080'
    const realm = process.env.KEYCLOAK_REALM || 'spis-dev'

    await this.respondOk({
      success: true,
      data:    {
        description: 'Keycloak RS256 JWT verification info',
        jwks_uri:    `${keycloakBase}/realms/${realm}/protocol/openid-connect/certs`,
        issuer:      `${keycloakBase}/realms/${realm}`,
        algorithm:   'RS256',
        explanation: {
          step1: 'Keycloak signs tokens with PRIVATE KEY (stored in Keycloak)',
          step2: 'Backend fetches PUBLIC KEYS from JWKS endpoint',
          step3: 'Backend verifies token signature using PUBLIC KEY',
          step4: 'If valid, token is authentic and untampered',
        },
      },
    })
  }
}
