/**
 * features/index.js — IAM service feature aggregator
 *
 * Registers all feature route handlers onto the Express app.
 * api.js calls registerFeatures(app) once instead of importing
 * each Api class individually.
 */

import { HealthApi }          from './health/healthApi.js'
import { KeycloakLoginApi }   from './keycloakLogin/keycloakLoginApi.js'
import { LoginApi }           from './login/loginApi.js'
import { OtpLoginApi }        from './otpLogin/otpLoginApi.js'
import { PasswordResetApi }   from './passwordReset/passwordResetApi.js'
import { InviteApi }          from './invite/inviteApi.js'
import { MfaApi }             from './mfa/mfaApi.js'
import { WorkerRegisterApi }  from './workerRegister/workerRegisterApi.js'
import { AdminApi }           from './admin/adminApi.js'

/**
 * Mount all IAM feature routes onto the Express app.
 * @param {import('express').Application} app
 * @param {{ connection?: object, redisClient?: object }} [options]
 */
export function registerFeatures(app, options = {}) {
  HealthApi.register(app, options)           // GET  /health, /healthz
  KeycloakLoginApi.register(app, options)    // POST /api/v1/auth/keycloak/*
  LoginApi.register(app, options)            // POST /api/v1/auth/login
  OtpLoginApi.register(app, options)         // POST /api/v1/auth/otp/*
  PasswordResetApi.register(app, options)    // POST /api/v1/auth/password-reset/*
  InviteApi.register(app, options)           // POST /api/v1/invites/*
  MfaApi.register(app, options)              // POST /api/v1/auth/mfa/*
  WorkerRegisterApi.register(app, options)   // POST /api/v1/auth/register/*
  AdminApi.register(app, options)            // GET/POST /api/v1/admin/*
}
