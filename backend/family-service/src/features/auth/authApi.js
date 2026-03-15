/**
 * authApi.js — route definitions for the auth feature
 *
 * Inline Zod validation per endpoint. No named schema exports.
 * handler.arguments declares which context values the controller method receives.
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { AuthController } from './authController.js'

export const AuthApi = new ApiSchema({
  name:      'Auth',
  url:       '/api/v1/auth',
  endpoints: [
    {
      path:    '/login',
      verb:    'POST',
      handler: { controller: AuthController, method: 'login', arguments: ['request:body'] },
      request: {
        body: z.object({
          national_id: z.string().min(1, 'National ID is required').max(50),
          password:    z.string().min(1, 'Password is required').max(128),
        }),
      },
    },
    {
      path:    '/otp-login/request',
      verb:    'POST',
      handler: { controller: AuthController, method: 'otpLoginRequest', arguments: ['request:body'] },
      request: {
        body: z.object({
          national_id: z.string().min(1, 'National ID is required').max(50),
        }),
      },
    },
    {
      path:    '/otp-login/verify',
      verb:    'POST',
      handler: { controller: AuthController, method: 'otpLoginVerify', arguments: ['request:body'] },
      request: {
        body: z.object({
          national_id: z.string().min(1, 'National ID is required').max(50),
          otp:         z.string().min(4).max(10),
        }),
      },
    },
    {
      path:    '/me',
      verb:    'GET',
      handler: { controller: AuthController, method: 'me', arguments: [] },
    },
    {
      path:    '/logout',
      verb:    'POST',
      handler: { controller: AuthController, method: 'logout', arguments: [] },
    },
  ],
})
