/**
 * IAM — Worker Register Service
 *
 * Self-registration flow for internal staff (Admin, CaseWorker, etc.)
 * Step 1: register — validate secret key, create pending user, send OTP.
 * Step 2: verify   — verify OTP, hash password, activate account.
 */

import bcrypt from 'bcrypt'
import { BaseService } from '../../../../base/baseService.js'
import { ApplicationError } from '../../../../base/applicationError.js'
import { hashNationalId, generateOtp, hashOtp, verifyOtp } from '../../lib/crypto.js'
import { sendOtpEmail } from '../../lib/emailClient.js'
import { WorkerRegisterRepository } from './workerRegisterRepository.js'

const WORKER_REGISTRATION_KEY = process.env.WORKER_REGISTRATION_SECRET
const OTP_EXPIRY_MS            = 10 * 60 * 1000
const VALID_ROLES              = ['Admin', 'CaseWorker', 'ProgrammeManager']

export class WorkerRegisterService extends BaseService {
  /**
   * @param {import('../../../../base/apiContext.js').ApiContext} ctx
   * @param {import('./workerRegisterRepository.js').WorkerRegisterRepository} repo
   */
  constructor(context) {
    super(context)
    this.workerRegisterRepository = new WorkerRegisterRepository(context)
  }

  /**
   * Step 1 — Validate input, create pending user, send OTP to email.
   */
  async register({ national_id, email, role, secret_key }) {
    if (!national_id || !email || !role || !secret_key) {
      throw ApplicationError.create(400, { message: 'National ID, email, role, and secret key are required', code: 'INVALID_INPUT' })
    }
    if (secret_key !== WORKER_REGISTRATION_KEY) {
      this.log.warn('Worker registration failed: invalid secret key', { email })
      throw ApplicationError.create(403, { message: 'Invalid secret key', code: 'INVALID_KEY' })
    }
    if (!VALID_ROLES.includes(role)) {
      throw ApplicationError.create(400, { message: 'Role must be Admin, CaseWorker, or ProgrammeManager', code: 'INVALID_ROLE' })
    }

    const nationalIdHash = hashNationalId(national_id)
    const existing       = await this.workerRegisterRepository.findByNationalIdHash(nationalIdHash)
    if (existing) {
      throw ApplicationError.create(409, { message: 'User with this National ID already exists', code: 'USER_EXISTS' })
    }

    const userId   = WorkerRegisterService.generateUUID()
    await this.workerRegisterRepository.createUser({ user_id: userId, email, national_id_hash: nationalIdHash, status: 'pending' })
    const otp       = generateOtp()
    const otpHash   = hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)

    await this.workerRegisterRepository.createOtpToken({ id: WorkerRegisterService.generateUUID(), userId, otpHash, purpose: 'worker_registration', expiresAt })
    await sendOtpEmail({ to_email: email, otp_code: otp, expires_at: expiresAt.toISOString(), purpose: 'Worker Registration' })

    this.log.info('Worker registration OTP sent', { email, role })
    return { message: 'OTP sent to your email. Please verify to complete registration.', email }
  }

  /**
   * Step 2 — Verify OTP, hash password, activate account, assign role.
   */
  async verify({ national_id, email, role, otp, password }) {
    if (!national_id || !email || !role || !otp || !password) {
      throw ApplicationError.create(400, { message: 'National ID, email, role, OTP, and password are required', code: 'INVALID_INPUT' })
    }
    if (password.length < 8) {
      throw ApplicationError.create(400, { message: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' })
    }

    const nationalIdHash = hashNationalId(national_id)
    const tempUser       = await this.workerRegisterRepository.findByNationalIdHash(nationalIdHash)
    if (!tempUser) {
      throw ApplicationError.create(400, { message: 'Registration session not found. Please start registration again.', code: 'USER_NOT_FOUND' })
    }

    const otpToken = await this.workerRegisterRepository.getActiveOtpToken(tempUser.user_id, 'worker_registration')
    if (!otpToken) {
      throw ApplicationError.create(400, { message: 'Invalid or expired OTP', code: 'INVALID_OTP' })
    }
    if (!verifyOtp(otp, otpToken.otp_hash)) {
      throw ApplicationError.create(400, { message: 'Invalid OTP code', code: 'INVALID_OTP' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await this.workerRegisterRepository.updatePassword(tempUser.user_id, {
      password_hash: passwordHash, updated_at: new Date().toISOString(),
    })
    await this.workerRegisterRepository.updateStatus(tempUser.user_id, 'active')
    const isRoleExists = await this.workerRegisterRepository.isUserRoleExists(tempUser.user_id, role)
    if (!isRoleExists) {
      await this.workerRegisterRepository.insertUserRole(tempUser.user_id, role)
    }
    await this.workerRegisterRepository.markOtpUsed(otpToken.id)

    this.log.info('Worker registered successfully', { userId: tempUser.user_id, email, role })
    return { message: 'Worker account created successfully. You can now login.', user_id: tempUser.user_id, email, role }
  }
}
