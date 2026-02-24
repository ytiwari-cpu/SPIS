/**
 * IAM — Invite Service
 *
 * Creates an IAM auth account for a registry member and sends an invitation.
 */

import { BaseService } from '../../../../base/baseService.js'
import { config } from '../../config.js'
import { logger } from '../../lib/logger.js'
import { generateOtp, hashOtp } from '../../lib/crypto.js'
import { sendInviteEmail } from '../../lib/emailClient.js'
import { cacheUserRegistryId } from '../../lib/redis.js'
import { publishAuthAccountCreated } from '../../bus/rabbitmq.js'
import { InviteRepository } from './inviteRepository.js'

export class InviteService extends BaseService {
  /** @param {InviteRepository} repo */
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  /**
   * Create an auth account for a registry member and send invitation email.
   */
  async createInvitedAccount({ registryId, email, nationalIdHash }) {
    // Check for existing account
    const existing = await this.repo.findByRegistryId(registryId)
    if (existing) {
      logger.info('Invite skipped — account already exists', { user_id: existing.user_id, registry_id: registryId })
      return { user_id: existing.user_id, message: 'Account already exists' }
    }

    // 1. Create local IAM user
    const user = await this.repo.createUser({
      email,
      registryId,
      nationalIdHash,
      status: 'pending',
    })

    // 2. Assign Citizen role
    await this.repo.addRole(user.user_id, 'Citizen')

    // 3. Generate invite OTP
    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    await this.repo.createOtpToken({
      userId:      user.user_id,
      otpHash,
      purpose:     'invite',
      expiresAt,
      maxAttempts: config.otp.maxAttempts,
    })

    // 4. Send invite email
    const inviteLink = `${config.corsOrigin}/auth/setup?token=${user.user_id}`
    try {
      await sendInviteEmail({ to_email: email, invite_link: inviteLink })
    } catch {
      logger.error('Failed to send invite email — Email Service down', { user_id: user.user_id, registry_id: registryId })
      // Degraded mode — account created but invite not sent
    }

    // 5. Cache registry mapping
    await cacheUserRegistryId(user.user_id, registryId)

    // 6. Publish event
    publishAuthAccountCreated({ user_id: user.user_id, registry_id: registryId, email })

    logger.info('Invited account created', { user_id: user.user_id, registry_id: registryId })

    return { user_id: user.user_id, message: 'Account created and invitation sent' }
  }
}
