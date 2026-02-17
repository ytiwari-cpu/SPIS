/**
 * SPIS Email Service — SendGrid Provider Adapter
 */

import sgMail from '@sendgrid/mail'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import type { EmailProviderAdapter, RenderedEmail, SendResult } from '../types.js'

if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey)
}

export const sendgridAdapter: EmailProviderAdapter = {
  name: 'sendgrid',

  async send(email: RenderedEmail): Promise<SendResult> {
    if (!config.sendgrid.apiKey) {
      return { success: false, error: 'SendGrid API key not configured' }
    }

    try {
      const [response] = await sgMail.send({
        to: email.to,
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName,
        },
        subject: email.subject,
        html: email.html,
        text: email.text,
      })

      const messageId = response.headers?.['x-message-id'] as string | undefined

      logger.info('SendGrid send success', {
        to_email: email.to,
        statusCode: response.statusCode,
        messageId,
      })

      return { success: true, messageId: messageId || undefined }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown SendGrid error'
      logger.error('SendGrid send failed', { to_email: email.to, error: message })
      return { success: false, error: message }
    }
  },

  async healthCheck(): Promise<boolean> {
    // SendGrid doesn't have a simple ping endpoint.
    // Check if API key is set as a basic health indicator.
    return !!config.sendgrid.apiKey
  },
}
