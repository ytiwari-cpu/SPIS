/**
 * IAM — Login API
 *
 * Route: POST /iam/login
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { LoginController } from './loginController.js'

const login = {
  path:    '/',
  verb:    'POST',
  handler: { controller: LoginController, method: 'login' },
}

export const LoginApi = new ApiSchema({
  name:      'Login',
  url:       '/iam/login',
  endpoints: [login],
})
