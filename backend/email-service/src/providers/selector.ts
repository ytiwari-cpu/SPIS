/**
 * SPIS Email Service — Provider Selector with Circuit Breaker
 *
 * Strategy:
 *   1. Try SendGrid (primary) if active / cooldown expired
 *   2. Fall back to SMTP
 *   3. On failure: increment consecutive_failures; mark 'cooldown' after threshold
 *   4. On success: reset consecutive_failures, mark 'active'
 */

import { config } from '../config.js'
import { logger } from '../lib/logger.js'
import {
  getActiveProvider,
  getProviders,
  recordProviderFailure,
  recordProviderSuccess,
} from '../db/repository.js'
import { sendgridAdapter } from './sendgrid.js'
import { smtpAdapter } from './smtp.js'
import type { EmailProviderAdapter, RenderedEmail, SendResult, ProviderName } from '../types.js'

const adapters: Record<ProviderName, EmailProviderAdapter> = {
  sendgrid: sendgridAdapter,
  smtp: smtpAdapter,
}

/**
 * Select the best available provider and send the email.
 * Tries primary (SendGrid) first, falls back to SMTP.
 * Records success/failure for circuit breaker state.
 */
export async function sendWithFallback(email: RenderedEmail): Promise<SendResult & { provider: ProviderName }> {
  // Get ordered list of available providers
  const providers = await getProviders()
  const ordered = providers
    .filter(p => p.status === 'active' || (p.status === 'cooldown' && p.cooldown_until && new Date(p.cooldown_until) < new Date()))
    .sort((a, b) => (a.provider_name === 'sendgrid' ? -1 : 1))

  if (ordered.length === 0) {
    // All providers down — try activeProvider as a last resort
    const lastResort = await getActiveProvider()
    if (lastResort) {
      ordered.push(lastResort)
    } else {
      logger.error('All email providers are down — cannot send', { to_email: email.to })
      return { success: false, error: 'All providers are down', provider: 'sendgrid' }
    }
  }

  for (const provider of ordered) {
    const adapter = adapters[provider.provider_name as ProviderName]
    if (!adapter) continue

    logger.info('Attempting send via provider', {
      provider: provider.provider_name,
      to_email: email.to,
    })

    const result = await adapter.send(email)

    if (result.success) {
      await recordProviderSuccess(provider.provider_name as ProviderName)
      return { ...result, provider: provider.provider_name as ProviderName }
    }

    // Record failure, trigger circuit breaker if threshold reached
    await recordProviderFailure(
      provider.provider_name as ProviderName,
      config.circuitBreaker.threshold,
      config.circuitBreaker.cooldownMs
    )

    logger.warn('Provider send failed, trying next', {
      provider: provider.provider_name,
      error: result.error,
    })
  }

  return { success: false, error: 'All providers failed', provider: ordered[0]?.provider_name as ProviderName ?? 'sendgrid' }
}

/**
 * Health check: return status of all providers
 */
export async function providerHealthCheck(): Promise<Record<string, { status: string; healthy: boolean }>> {
  const result: Record<string, { status: string; healthy: boolean }> = {}

  for (const [name, adapter] of Object.entries(adapters)) {
    const healthy = await adapter.healthCheck()
    const providers = await getProviders()
    const row = providers.find(p => p.provider_name === name)
    result[name] = {
      status: row?.status || 'unknown',
      healthy,
    }
  }

  return result
}
