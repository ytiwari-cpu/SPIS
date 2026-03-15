/**
 * SPIS IAM Service — Email Service Client
 *
 * HTTP client to the standalone Email Service (port 3002).
 * Used for sending OTP codes and invitation emails.
 */

import axios from 'axios'
import { config } from '../config.js'
import { createLogger } from '../../../base/logger.js'
const logger = createLogger('iam-service')

const client = axios.create({
  baseURL: config.emailServiceUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Key': process.env.SERVICE_AUTH_KEY || '',
  },
})

/**
 * Send an OTP email via the Email Service.
 * Returns the request_id from the email service.
 */
export async function sendOtpEmail(params: {
  to_email: string
  otp_code: string
  expires_at: string
  purpose?: string
  locale?: string
}): Promise<string> {
  try {
    const res = await client.post('/email/otp', params)
    logger.info('OTP email queued', { to_email: params.to_email, request_id: res.data.request_id })
    return res.data.request_id as string
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? `Email Service error: ${err.response?.status} ${err.response?.data?.error?.message || err.response?.data?.error || err.message}`
      : (err as Error).message
    logger.error('Failed to send OTP email', { to_email: params.to_email, error: msg })
    throw new Error(msg)
  }
}

/**
 * Send an invitation email via the Email Service.
 */
export async function sendInviteEmail(params: {
  to_email: string
  family_name?: string
  invite_link: string
  locale?: string
}): Promise<string> {
  try {
    const res = await client.post('/email/invite', params)
    logger.info('Invite email queued', { to_email: params.to_email, request_id: res.data.request_id })
    return res.data.request_id as string
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? `Email Service error: ${err.response?.status} ${err.response?.data?.error?.message || err.message}`
      : (err as Error).message
    logger.error('Failed to send invite email', { to_email: params.to_email, error: msg })
    throw new Error(msg)
  }
}

/**
 * Send a generic notification email via the Email Service.
 */
export async function sendNotificationEmail(params: {
  to_email: string
  template_code: string
  variables: Record<string, unknown>
  locale?: string
}): Promise<string> {
  try {
    const res = await client.post('/email/notify', params)
    logger.info('Notification email queued', { to_email: params.to_email, request_id: res.data.request_id })
    return res.data.request_id as string
  } catch (err) {
    const msg = axios.isAxiosError(err)
      ? `Email Service error: ${err.response?.status} ${err.response?.data?.error?.message || err.message}`
      : (err as Error).message
    logger.error('Failed to send notification email', { to_email: params.to_email, error: msg })
    throw new Error(msg)
  }
}

/**
 * Check if the Email Service is reachable.
 */
export async function emailServiceHealthy(): Promise<boolean> {
  try {
    const res = await client.get('/healthz')
    return res.data?.status === 'ok'
  } catch {
    return false
  }
}
