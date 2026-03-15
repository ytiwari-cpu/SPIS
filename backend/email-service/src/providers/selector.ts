/**
 * SPIS Email Service — Provider Selector
 *
 * Orchestrates multi-provider email delivery with automatic fallback.
 * Primary: SendGrid — Fallback: SMTP
 *
 * sendWithFallback  — tries primary, falls back to secondary on failure
 * providerHealthCheck — returns health status of all registered providers
 */

import { createLogger } from '../../../base/logger.js'
import { sendgridAdapter } from './sendgrid.js'
import { smtpAdapter }     from './smtp.js'
import type { RenderedEmail, ProviderName } from '../types.js'

const logger = createLogger('email-service')

export interface FallbackSendResult {
  success:     boolean
  provider?:   ProviderName
  messageId?:  string
  error?:      string
}

export interface ProviderHealthStatus {
  healthy: boolean
}

const PROVIDERS = [sendgridAdapter, smtpAdapter]

/**
 * Try each provider in order until one succeeds.
 * Returns the result enriched with which provider actually sent the email.
 */
export async function sendWithFallback(email: RenderedEmail): Promise<FallbackSendResult> {
  const errors: string[] = []

  for (const provider of PROVIDERS) {
    try {
      const result = await provider.send(email)

      if (result.success) {
        logger.info('Email sent via provider', {
          provider: provider.name,
          to_email: email.to,
          messageId: result.messageId,
        })
        return {
          success:    true,
          provider:   provider.name,
          messageId:  result.messageId,
        }
      }

      const err = result.error || `${provider.name} returned failure without error message`
      logger.warn(`Provider ${provider.name} failed — trying next`, { to_email: email.to, error: err })
      errors.push(`${provider.name}: ${err}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Unknown error from ${provider.name}`
      logger.warn(`Provider ${provider.name} threw — trying next`, { to_email: email.to, error: message })
      errors.push(`${provider.name}: ${message}`)
    }
  }

  // All providers exhausted
  const combinedError = errors.join(' | ')
  logger.error('All providers failed', { to_email: email.to, errors: combinedError })
  return { success: false, error: combinedError }
}

/**
 * Run healthCheck() on all registered providers.
 * Returns a map of { providerName: { healthy: boolean } }
 */
export async function providerHealthCheck(): Promise<Record<string, ProviderHealthStatus>> {
  const results: Record<string, ProviderHealthStatus> = {}

  await Promise.all(
    PROVIDERS.map(async (provider) => {
      try {
        const healthy = await provider.healthCheck()
        results[provider.name] = { healthy }
      } catch {
        results[provider.name] = { healthy: false }
      }
    }),
  )

  return results
}
