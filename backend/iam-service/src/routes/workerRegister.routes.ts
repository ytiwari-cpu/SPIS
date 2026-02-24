/**
 * Worker Registration Routes
 * Self-registration for workers (Admin, CaseWorker) with secret key validation
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { hashNationalId, generateOtp, hashOtp } from '../lib/crypto.js'
import { sendOtpEmail } from '../lib/emailClient.js'
import { createUser, getUserByNationalIdHash, addRole, createOtpToken } from '../db/repository.js'
import { logger } from '../lib/logger.js'
import {
  getKeycloakUserByUsername,
  createKeycloakUser,
  updateKeycloakPassword,
} from '../lib/keycloak.js'

const router = Router()

// Secret key for worker registration
const WORKER_REGISTRATION_KEY = "j'F-7cU&uRM&_0dJ`x0.&\"m[.~7E8SPk`8C!Es@d"
const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

interface WorkerRegisterRequest {
  national_id: string
  email: string
  role: 'Admin' | 'CaseWorker' | 'SuperAdmin' | 'ProgrammeManager'
  secret_key: string
}

interface WorkerVerifyRequest {
  national_id: string
  email: string
  role: 'Admin' | 'CaseWorker' | 'SuperAdmin' | 'ProgrammeManager'
  otp: string
  password: string
}

/**
 * POST /iam/worker-register
 * Step 1: Validate secret key and send OTP
 */
router.post('/worker-register', async (req: Request, res: Response) => {
  try {
    const { national_id, email, role, secret_key }: WorkerRegisterRequest = req.body

    // 1. Validate input
    if (!national_id || !email || !role || !secret_key) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'National ID, email, role, and secret key are required'
        }
      })
    }

    // 2. Validate secret key
    if (secret_key !== WORKER_REGISTRATION_KEY) {
      logger.warn('Worker registration failed: invalid secret key', { email })
      return res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_KEY',
          message: 'Invalid secret key'
        }
      })
    }

    // 3. Validate role
    if (!['Admin', 'CaseWorker', 'SuperAdmin', 'ProgrammeManager'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be Admin, CaseWorker, or SuperAdmin'
        }
      })
    }

    // 4. Check if user already exists
    const nationalIdHash = hashNationalId(national_id)
    const existingUser = await getUserByNationalIdHash(nationalIdHash)

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this National ID already exists'
        }
      })
    }

    // 5. Create temporary user (pending status, no password)
    const tempUser = await createUser({
      email,
      nationalIdHash,
      status: 'pending'
    })

    // 6. Generate and send OTP
    const otp = generateOtp()
    const otpHash = hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS)

    await createOtpToken({
      userId: tempUser.user_id,
      otpHash,
      purpose: 'worker_registration',
      expiresAt
    })

    // Send OTP email
    await sendOtpEmail({
      to_email: email,
      otp_code: otp,
      expires_at: expiresAt.toISOString(),
      purpose: 'Worker Registration'
    })

    logger.info('Worker registration OTP sent', { email, role })

    return res.json({
      success: true,
      data: {
        message: 'OTP sent to your email. Please verify to complete registration.',
        email
      }
    })
  } catch (error) {
    logger.error('Worker registration error', { error })
    return res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_ERROR',
        message: error instanceof Error ? error.message : 'Registration failed'
      }
    })
  }
})

/**
 * POST /iam/worker-register/verify
 * Step 2: Verify OTP and set password
 */
router.post('/worker-register/verify', async (req: Request, res: Response) => {
  try {
    const { national_id, email, role, otp, password }: WorkerVerifyRequest = req.body

    // 1. Validate input
    if (!national_id || !email || !role || !otp || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'National ID, email, role, OTP, and password are required'
        }
      })
    }

    // 2. Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters'
        }
      })
    }

    // 3. Find the temporary user by national_id_hash
    const nationalIdHash = hashNationalId(national_id)
    const tempUser = await getUserByNationalIdHash(nationalIdHash)

    if (!tempUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Registration session not found. Please start registration again.'
        }
      })
    }

    // 4. Get OTP token
    const { getActiveOtpToken, markOtpUsed, updateUserStatus } = await import('../db/repository.js')
    const { verifyOtp } = await import('../lib/crypto.js')

    const otpToken = await getActiveOtpToken(tempUser.user_id, 'worker_registration')
    if (!otpToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid or expired OTP'
        }
      })
    }

    // 5. Verify OTP
    const isValidOtp = verifyOtp(otp, otpToken.otp_hash)
    if (!isValidOtp) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid OTP code'
        }
      })
    }

    // 6. Activate user status (no local password storage)
    await updateUserStatus(tempUser.user_id, 'active')

    // 7. Set password in Keycloak ONLY - no local storage
    try {
      const keycloakUser = await getKeycloakUserByUsername(national_id)
      if (keycloakUser) {
        await updateKeycloakPassword(keycloakUser.id, password)
        logger.info('Worker password updated in Keycloak', { userId: tempUser.user_id })
      } else {
        await createKeycloakUser({
          username: national_id,
          email,
          password,
          enabled: true,
        })
        logger.info('Worker created in Keycloak', { userId: tempUser.user_id })
      }
    } catch (keycloakError) {
      // If Keycloak fails, worker registration fails completely
      logger.error('Failed to create worker in Keycloak', {
        userId: tempUser.user_id,
        error: (keycloakError as Error).message,
      })
      return res.status(500).json({
        success: false,
        error: {
          code: 'KEYCLOAK_ERROR',
          message: 'Worker registration failed. Please try again.'
        }
      })
    }

    // 8. Assign role
    await addRole(tempUser.user_id, role)

    // 9. Mark OTP as used
    await markOtpUsed(otpToken.id)

    logger.info('Worker registered successfully', { userId: tempUser.user_id, email, role })

    return res.json({
      success: true,
      data: {
        message: 'Worker account created successfully. You can now login.',
        user_id: tempUser.user_id,
        email,
        role
      }
    })
  } catch (error) {
    logger.error('Worker registration verification error', { error })
    return res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_ERROR',
        message: error instanceof Error ? error.message : 'Verification failed'
      }
    })
  }
})

export default router
