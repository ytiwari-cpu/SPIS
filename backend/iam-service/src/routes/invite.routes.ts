/**
 * SPIS IAM Service — Invite Routes
 *
 * POST /iam/invite — create auth account for a registry member
 */

import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { InviteSchema } from '../validators/schemas.js'
import { ApiContext } from '../../../base/apiContext.js'
import { InviteController } from '../features/invite/inviteController.js'

export const inviteRouter = Router()

inviteRouter.post('/', rateLimiters.invite, validate(InviteSchema), async (req, res, next) => {
  try {
    const ctx = new ApiContext(req, res)
    await new InviteController(ctx).create()
  } catch (err) { next(err) }
})
