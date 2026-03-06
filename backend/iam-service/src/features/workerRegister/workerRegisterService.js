/**
 * IAM — Worker Register Service
 *
 * Self-registration flow for internal staff (Admin, CaseWorker, etc.)
 * Step 1: register — validate secret key, create pending user, send OTP.
 * Step 2: verify   — verify OTP, hash password, activate account.
 */

import bcrypt from 'bcrypt'
import { BaseService } from '../../../../base/baseService.js'
import { createLogger } from '../../../../base/logger.js'
const logger = createLogger('iam-service')
import { hashNationalId, generateOtp, hashOtp, verifyOtp } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { WorkerRegisterRepository } from './workerRegisterRepository.js'

const WORKER_REGISTRATION_KEY = "j'F-7cU&uRM&_0dJ`x0.&\"m[.~7E8SPk`8C!Es@d"
const OTP_EXPIRY_MS            = 10 * 60 * 1000
const VALID_ROLES              = ['Admin', 'CaseWorker', 'SuperAdmin', 'ProgrammeManager']

export class WorkerRegisterService extends BaseService {
  /** @param {WorkerRegisterRepository} repo */
  constructor(repo) {
    super(repo.context)
    this.repo = repo
  }

  /**
   * Step 1 — Validate input, create pending user, send OTP to email.
   */
  async register({ national_id, email, role, secret_key }) {
    if (!national_id || !email || !role || !secret_key) {
      throw Object.assign(
        new Error('National ID, email, role, and secret key are required'),
        { statusCode: 400, code: 'INVALID_INPUT' },
      )
    }
    if (secret_key !== WORKER_REGISTRATION_KEY) {
      logger.warn('Worker registration failed: invalid secret key', { email })
      throw Object.assign(new Error('Invalid secret key'), { statusCode: 403, code: 'INVALID_KEY' })
    }
    if (!VALID_ROLES.includes(role)) {
      throw Object.assign(
        new Error('Role must be Admin, CaseWorker, SuperAdmin, or ProgrammeManager'),
        { statusCode: 400, code: 'INVALID_ROLE' },
      )
    }

    const nationalIdHash = hashNationalId(national_id)
    const existing       = await this.repo.findByNationalIdHash(nationalIdHash)
    if (existing) {
      throw Object.assign(
        new Error('User with this National ID already exists'),
        { statusCode: 409, code: 'USER_EXISTS' },
      )
    }

    const tempUser  = await this.repo.createUser({ email, nationalIdHash, status: 'pending' })
    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)

    await this.repo.createOtpToken({ userId: tempUser.user_id, otpHash, purpose: 'worker_registration', expiresAt })
    await sendOtpEmail({ to_email: email, otp_code: otp, expires_at: expiresAt.toISOString(), purpose: 'Worker Registration' })

    logger.info('Worker registration OTP sent', { email, role })
    return { message: 'OTP sent to your email. Please verify to complete registration.', email }
  }

  /**
   * Step 2 — Verify OTP, hash password, activate account, assign role.
   */
  async verify({ national_id, email, role, otp, password }) {
    if (!national_id || !email || !role || !otp || !password) {
      throw Object.assign(
        new Error('National ID, email, role, OTP, and password are required'),
        { statusCode: 400, code: 'INVALID_INPUT' },
      )
    }
    if (password.length < 8) {
      throw Object.assign(new Error('Password must be at least 8 characters'), { statusCode: 400, code: 'WEAK_PASSWORD' })
    }

    const nationalIdHash = hashNationalId(national_id)
    const tempUser       = await this.repo.findByNationalIdHash(nationalIdHash)
    if (!tempUser) {
      throw Object.assign(
        new Error('Registration session not found. Please start registration again.'),
        { statusCode: 400, code: 'USER_NOT_FOUND' },
      )
    }

    const otpToken = await this.repo.getActiveOtpToken(tempUser.user_id, 'worker_registration')
    if (!otpToken) {
      throw Object.assign(new Error('Invalid or expired OTP'), { statusCode: 400, code: 'INVALID_OTP' })
    }
    if (!verifyOtp(otp, otpToken.otp_hash)) {
      throw Object.assign(new Error('Invalid OTP code'), { statusCode: 400, code: 'INVALID_OTP' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await this.repo.updatePassword(tempUser.user_id, passwordHash)
    await this.repo.updateStatus(tempUser.user_id, 'active')
    await this.repo.addRole(tempUser.user_id, role)
    await this.repo.markOtpUsed(otpToken.id)

    logger.info('Worker registered successfully', { userId: tempUser.user_id, email, role })
    return { message: 'Worker account created successfully. You can now login.', user_id: tempUser.user_id, email, role }
  }
}
