/**
 * SPIS IAM Service — Invite Service
 *
 * Flow C: Registry-driven invitation.
 *   1. Registry emits CREATE_AUTH_ACCOUNT { registry_id, email, national_id_hash }
 *   2. IAM creates user record + Keycloak account
 *   3. Sends invite OTP via Email Service
 *   4. Publishes AUTH_ACCOUNT_CREATED event
 */

import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import { generateOtp, hashOtp } from '../lib/crypto.js'
import { sendInviteEmail } from '../lib/emailClient.js'
import {
  createUser, getUserByRegistryId, addRole,
  createOtpToken,
} from '../db/repository.js'
import { cacheUserRegistryId } from '../lib/redis.js'
import { publishAuthAccountCreated } from '../bus/rabbitmq.js'

/**
 * Create an auth account for a registry member and send invitation.
 */
export async function createInvitedAccount(params: {
  registryId: string
  email: string
  nationalIdHash?: string
  nationalId?: string
}): Promise<{ user_id: string; message: string }> {
  const { registryId, email, nationalIdHash } = params

  // Check if account already exists for this registry_id
  const existing = await getUserByRegistryId(registryId)
  if (existing) {
    logger.info('Invite skipped — account already exists', {
      user_id: existing.user_id,
      registry_id: registryId,
    })
    return { user_id: existing.user_id, message: 'Account already exists' }
  }

  // 1. Create local IAM user
  const user = await createUser({
    email,
    registryId,
    nationalIdHash,
    status: 'pending',
  })

  // 2. Assign default Citizen role
  await addRole(user.user_id, 'Citizen')

  // 3. Generate invite OTP
  const otp = generateOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000)

  await createOtpToken({
    userId: user.user_id,
    otpHash,
    purpose: 'invite',
    expiresAt,
    maxAttempts: config.otp.maxAttempts,
  })

  // 5. Send invite email via Email Service
  const inviteLink = `${config.corsOrigin}/auth/setup?token=${user.user_id}`
  try {
    await sendInviteEmail({
      to_email: email,
      invite_link: inviteLink,
    })
  } catch {
    logger.error('Failed to send invite email — Email Service down', {
      user_id: user.user_id,
      registry_id: registryId,
    })
    // Degraded mode — account created but invite not sent
  }

  // 6. Cache registry mapping
  await cacheUserRegistryId(user.user_id, registryId)

  // 7. Publish AUTH_ACCOUNT_CREATED event
  publishAuthAccountCreated({
    user_id: user.user_id,
    registry_id: registryId,
    email,
  })

  logger.info('Invited account created', {
    user_id: user.user_id,
    registry_id: registryId,
  })

  return {
    user_id: user.user_id,
    message: 'Account created and invitation sent',
  }
}
