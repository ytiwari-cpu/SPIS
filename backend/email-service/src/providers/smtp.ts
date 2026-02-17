/**
 * SPIS Email Service — SMTP Fallback Provider Adapter
 *
 * Uses Nodemailer to send email via generic SMTP.
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import type { EmailProviderAdapter, RenderedEmail, SendResult } from '../types.js'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
    })
  }
  return transporter
}

export const smtpAdapter: EmailProviderAdapter = {
  name: 'smtp',

  async send(email: RenderedEmail): Promise<SendResult> {
    try {
      const transport = getTransporter()

      const info = await transport.sendMail({
        from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      })

      logger.info('SMTP send success', {
        to_email: email.to,
        messageId: info.messageId,
      })

      return { success: true, messageId: info.messageId }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown SMTP error'
      logger.error('SMTP send failed', { to_email: email.to, error: message })
      return { success: false, error: message }
    }
  },

  async healthCheck(): Promise<boolean> {
    try {
      const transport = getTransporter()
      await transport.verify()
      return true
    } catch {
      return false
    }
  },
}
