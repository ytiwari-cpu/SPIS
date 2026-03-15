/**
 * features/index.js — family-service feature aggregator
 *
 * Registers all feature route handlers onto the Express app.
 * api.js calls registerFeatures(app) once instead of importing
 * each Api class individually.
 */

import { AuthApi }                        from './auth/authApi.js'
import { FamilyApi }                      from './family/familyApi.js'
import { MemberApi, MemberPublicApi }     from './member/memberApi.js'
import { AddressApi }                     from './address/addressApi.js'
import { DocumentApi }                    from './document/documentApi.js'
import { CitizensApi }                    from './citizens/citizensApi.js'
import { RegistrationApi }               from './registration/registrationApi.js'
import { UploadApi }                      from './upload/uploadApi.js'
import { SqlEditorApi }                   from './sqlEditor/sqlEditorApi.js'

/**
 * Mount all family-service feature routes onto the Express app.
 * @param {import('express').Application} app
 * @param {{ connection?: object, redisClient?: object }} [options]
 */
export function registerFeatures(app, options = {}) {
  AuthApi.register(app, options)          // POST /api/v1/auth/*
  FamilyApi.register(app, options)        // GET/POST /api/v1/families/*
  MemberApi.register(app, options)        // GET/POST /api/v1/members/*
  MemberPublicApi.register(app, options)  // GET  /api/v1/public/members/lookup
  AddressApi.register(app, options)       // GET/POST /api/v1/addresses/*
  DocumentApi.register(app, options)      // GET/POST /api/v1/documents/*
  CitizensApi.register(app, options)      // GET/POST /api/v1/citizens/*
  RegistrationApi.register(app, options)  // GET/POST /api/v1/registration/*
  UploadApi.register(app, options)        // POST/GET/DELETE /api/v1/upload/*
  SqlEditorApi.register(app, options)     // GET/POST/DELETE /api/v1/dev/*
}
