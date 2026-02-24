/**
 * auth/api.js — route definitions for the auth feature
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { AuthController } from './authController.js'

const login      = { path: '/login',       verb: 'POST', handler: { controller: AuthController, method: 'login' },          middleware: [] }
const otpRequest = { path: '/otp/request', verb: 'POST', handler: { controller: AuthController, method: 'otpLoginRequest' }, middleware: [] }
const otpVerify  = { path: '/otp/verify',  verb: 'POST', handler: { controller: AuthController, method: 'otpLoginVerify' },  middleware: [] }
const me         = { path: '/me',          verb: 'GET',  handler: { controller: AuthController, method: 'me' },              middleware: [] }
const logout     = { path: '/logout',      verb: 'POST', handler: { controller: AuthController, method: 'logout' },         middleware: [] }

export const AuthApi = new ApiSchema({
  name:      'Auth',
  url:       '/api/v1/auth',
  endpoints: [login, otpRequest, otpVerify, me, logout],
})
