/**
 * IAM — Invite API
 *
 * Route: POST /iam/invite
 */

import { ApiSchema } from '../../../../base/apiSchema.js'
import { InviteController } from './inviteController.js'
import { rateLimiters } from '../../middleware/rateLimiter.js'

const create = {
  path:       '/',
  verb:       'POST',
  handler:    { controller: InviteController, method: 'create' },
  middleware: [rateLimiters.invite],
}

export const InviteApi = new ApiSchema({
  name:      'Invite',
  url:       '/iam/invite',
  endpoints: [create],
})
