/**
 * IAM — Login API
 *
 * Route: POST /iam/login
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { LoginController } from './loginController.js'

const login = {
  path:    '/',
  verb:    'POST',
  handler: { controller: LoginController, method: 'login', arguments: ['request:body'] },
  request: {
    body: z.object({
      national_id: z.string().min(1, 'National ID is required').max(50),
      password:    z.string().min(1, 'Password is required').max(72),
    }),
  },
}

export const LoginApi = new ApiSchema({
  name:      'Login',
  url:       '/iam/login',
  endpoints: [login],
})
