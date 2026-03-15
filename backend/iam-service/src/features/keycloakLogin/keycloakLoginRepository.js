/**
 * IAM — Keycloak Login Repository
 *
 * Thin wrapper: delegates to LoginRepository since keycloak login
 * operates on the same users/auth_events tables.
 */

import { LoginRepository } from '../login/loginRepository.js'

export class KeycloakLoginRepository extends LoginRepository {
  constructor(context) {
    super(context)
  }
}
