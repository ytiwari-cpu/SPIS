/**
 * SPIS Email Service — Email API Routes
 *
 * POST /email/otp     — Send OTP email
 * POST /email/invite  — Send invitation email
 * POST /email/notify  — Send generic notification
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { validate } from '../middleware/validate.js'
import { SendOtpSchema, SendInviteSchema, SendNotifySchema } from '../validators/schemas.js'
import { createEmailRequest } from '../db/repository.js'
import { enforceRateLimits } from '../services/rateLimiter.js'
import { publishEmailSend } from '../bus/rabbitmq.js'
import { logger } from '../lib/logger.js'
import { TooManyRequestsError } from '../middleware/errorHandler.js'

export const emailRouter = Router()

// ═══════════════════════════════════════════════════════════════
// POST /email/otp
// ═══════════════════════════════════════════════════════════════

emailRouter.post('/otp', validate(SendOtpSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to_email, otp_code, expires_at, locale, purpose, request_id } = req.body

    // Rate limit check
    const rl = await enforceRateLimits({ to_email, purpose: 'otp' })
    if (!rl.allowed) {
      throw new TooManyRequestsError('OTP rate limit exceeded', {
        limit: rl.limitName,
        resetAt: rl.resetAt,
      })
    }

    // Create DB record (idempotent if request_id provided)
    const emailReq = await createEmailRequest({
      request_id: request_id || uuidv4(),
      to_email,
      template_code: purpose === 'password_reset' ? 'password_reset' : 'iam_otp',
      payload_json: { otp_code, expires_at, locale, purpose },
    })

    // Publish to queue
    publishEmailSend({
      request_id: emailReq.request_id,
      to_email,
      template_code: emailReq.template_code,
      variables: { otp_code, expires_at, purpose },
      locale: locale || 'en',
      attempt: 1,
    })

    logger.info('OTP email queued', { request_id: emailReq.request_id, to_email, purpose })

    res.status(202).json({
      success: true,
      request_id: emailReq.request_id,
      status: 'queued',
      message: 'OTP email queued for delivery',
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /email/invite
// ═══════════════════════════════════════════════════════════════

emailRouter.post('/invite', validate(SendInviteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to_email, invite_link, locale, request_id } = req.body

    // Rate limit check
    const rl = await enforceRateLimits({ to_email, purpose: 'invite' })
    if (!rl.allowed) {
      throw new TooManyRequestsError('Invite rate limit exceeded', {
        limit: rl.limitName,
        resetAt: rl.resetAt,
      })
    }

    // Create DB record
    const emailReq = await createEmailRequest({
      request_id: request_id || uuidv4(),
      to_email,
      template_code: 'invite',
      payload_json: { invite_link, locale },
    })

    // Publish to queue
    publishEmailSend({
      request_id: emailReq.request_id,
      to_email,
      template_code: 'invite',
      variables: { invite_link },
      locale: locale || 'en',
      attempt: 1,
    })

    logger.info('Invite email queued', { request_id: emailReq.request_id, to_email })

    res.status(202).json({
      success: true,
      request_id: emailReq.request_id,
      status: 'queued',
      message: 'Invite email queued for delivery',
    })
  } catch (err) {
    next(err)
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /email/notify
// ═══════════════════════════════════════════════════════════════

emailRouter.post('/notify', validate(SendNotifySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to_email, template_code, variables, locale, request_id } = req.body

    // Rate limit check (notify uses global limit only)
    const rl = await enforceRateLimits({ to_email, purpose: 'notify' })
    if (!rl.allowed) {
      throw new TooManyRequestsError('Global rate limit exceeded', {
        limit: rl.limitName,
        resetAt: rl.resetAt,
      })
    }

    // Create DB record
    const emailReq = await createEmailRequest({
      request_id: request_id || uuidv4(),
      to_email,
      template_code,
      payload_json: { ...variables, locale },
    })

    // Publish to queue
    publishEmailSend({
      request_id: emailReq.request_id,
      to_email,
      template_code,
      variables,
      locale: locale || 'en',
      attempt: 1,
    })

    logger.info('Notify email queued', { request_id: emailReq.request_id, to_email, template_code })

    res.status(202).json({
      success: true,
      request_id: emailReq.request_id,
      status: 'queued',
      message: 'Notification email queued for delivery',
    })
  } catch (err) {
    next(err)
  }
})
