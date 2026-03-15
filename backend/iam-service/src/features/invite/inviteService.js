/**
 * IAM — Invite Service
 *
 * Creates an IAM auth account for a registry member and sends an invitation.
 */

import crypto from 'node:crypto'
import { BaseService } from '../../../../base/baseService.js'
import { config } from '../../config.js'
import { sendInviteEmail } from '../../lib/emailClient.js'
import { cacheUserRegistryId } from '../../lib/redis.js'
import { publishAuthAccountCreated } from '../../bus/rabbitmq.js'
import { InviteRepository } from './inviteRepository.js'

export class InviteService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} ctx
   * @param {import('./inviteRepository.js').InviteRepository} repo
   */
  constructor(context) {
    super(context)
    this.inviteRepository = new InviteRepository(context)
  }

  /**
   * Create an auth account for a registry member and send invitation email.
   */
  async createInvitedAccount({ registryId, email, nationalIdHash }) {
    // Check for existing account
    const existing = await this.inviteRepository.findByRegistryId(registryId)
    if (existing) {
      this.log.info('Invite skipped — account already exists', { user_id: existing.user_id, registry_id: registryId })
      return { user_id: existing.user_id, message: 'Account already exists' }
    }

    // 1. Create local IAM user
    const user = await this.inviteRepository.createUser({
      email,
      registryId,
      nationalIdHash,
      status: 'pending',
    })

    // 2. Assign Citizen role (skip if already assigned)
    const isRoleExists = await this.inviteRepository.isUserRoleExists(user.user_id, 'Citizen')
    if (!isRoleExists) {
      await this.inviteRepository.insertUserRole(user.user_id, 'Citizen')
    }

    // 3. Generate invite token (cryptographically random, not predictable)
    const rawToken  = crypto.randomBytes(48).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

    await this.inviteRepository.createOtpToken({
      id:          InviteService.generateUUID(),
      userId:      user.user_id,
      otpHash:     tokenHash,
      purpose:     'invite',
      expiresAt,
      maxAttempts: 1,
    })

    // 4. Send invite email with the raw token (DB stores only the hash)
    const inviteLink = `${config.corsOrigin}/auth/setup?token=${rawToken}`
    try {
      await sendInviteEmail({ to_email: email, invite_link: inviteLink })
    } catch {
      this.log.error('Failed to send invite email — Email Service down', { user_id: user.user_id, registry_id: registryId })
      // Degraded mode — account created but invite not sent
    }

    // 5. Cache registry mapping
    await cacheUserRegistryId(user.user_id, registryId)

    // 6. Publish event
    publishAuthAccountCreated({ user_id: user.user_id, registry_id: registryId, email })

    this.log.info('Invited account created', { user_id: user.user_id, registry_id: registryId })

    return { user_id: user.user_id, message: 'Account created and invitation sent' }
  }
}
