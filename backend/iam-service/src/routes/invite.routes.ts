/**
 * SPIS IAM Service — Invite Routes
 *
 * POST /iam/invite — create auth account for a registry member
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { validate } from '../middleware/validate.js'
import { rateLimiters } from '../middleware/rateLimiter.js'
import { InviteSchema } from '../validators/schemas.js'
import { createInvitedAccount } from '../services/invite.js'

export const inviteRouter = Router()

// POST /iam/invite
inviteRouter.post(
  '/',
  rateLimiters.invite,
  validate(InviteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createInvitedAccount({
        registryId: req.body.registry_id,
        email: req.body.email,
        nationalIdHash: req.body.national_id_hash,
        nationalId: req.body.national_id,
      })
      res.status(201).json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  },
)
