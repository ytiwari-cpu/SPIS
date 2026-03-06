/**
 * SPIS IAM Service — RabbitMQ Bus
 *
 * Topology:
 *   Exchange: spis.events (type=topic, durable)
 *   Consume queues:
 *     iam.registry  ← routing keys: registry.events.CREATE_AUTH_ACCOUNT,
 *                                     registry.events.USER_CONTACT_UPDATED,
 *                                     registry.events.USER_DELETED
 *   Publish routing keys:
 *     iam.events.AUTH_ACCOUNT_CREATED
 *     iam.events.PASSWORD_RESET_REQUESTED
 *     iam.events.MFA_ENABLED
 */

import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib'
import { config } from '../config.js'
import { createLogger } from '../../../base/logger.js'
const logger = createLogger('iam-service')

let connection: ChannelModel | null = null
let publishChannel: Channel | null = null

const EXCHANGE = config.rabbitmqExchange  // 'spis.events'

// ── Queues IAM consumes ──────────────────────────────────────
export const QUEUES = {
  iamRegistry: 'iam.registry',
} as const

// ── Routing keys IAM listens to (inbound from Registry) ─────
export const INBOUND_KEYS = {
  createAuthAccount:   'registry.events.CREATE_AUTH_ACCOUNT',
  userContactUpdated:  'registry.events.USER_CONTACT_UPDATED',
  userDeleted:         'registry.events.USER_DELETED',
} as const

// ── Routing keys IAM publishes (outbound) ────────────────────
export const OUTBOUND_KEYS = {
  authAccountCreated:       'iam.events.AUTH_ACCOUNT_CREATED',
  passwordResetRequested:   'iam.events.PASSWORD_RESET_REQUESTED',
  mfaEnabled:               'iam.events.MFA_ENABLED',
} as const

// ═══════════════════════════════════════════════════════════════
// CONNECTION
// ═══════════════════════════════════════════════════════════════

export async function connectBus(): Promise<void> {
  try {
    connection = await amqplib.connect(config.rabbitmqUrl)
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message })
    })
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed — will reconnect in 5s')
      setTimeout(() => connectBus().catch(() => {}), 5000)
    })

    publishChannel = await connection.createChannel()

    // Declare shared exchange
    await publishChannel.assertExchange(EXCHANGE, 'topic', { durable: true })

    // Declare IAM consumer queue and bind to all inbound routing keys
    await publishChannel.assertQueue(QUEUES.iamRegistry, { durable: true })
    for (const key of Object.values(INBOUND_KEYS)) {
      await publishChannel.bindQueue(QUEUES.iamRegistry, EXCHANGE, key)
    }

    logger.info('RabbitMQ connected (IAM)', {
      exchange: EXCHANGE,
      queues: Object.values(QUEUES),
      inboundKeys: Object.values(INBOUND_KEYS),
    })
  } catch (err) {
    logger.error('RabbitMQ connection failed', { error: err instanceof Error ? err.message : 'unknown' })
    setTimeout(() => connectBus().catch(() => {}), 5000)
  }
}

export async function closeBus(): Promise<void> {
  try {
    await publishChannel?.close()
    await connection?.close()
  } catch {
    // ignore close errors
  }
}

// ═══════════════════════════════════════════════════════════════
// PUBLISH
// ═══════════════════════════════════════════════════════════════

export function publish(routingKey: string, payload: Record<string, unknown>): boolean {
  if (!publishChannel) {
    logger.error('Cannot publish — no RabbitMQ channel', { routingKey })
    return false
  }

  const buffer = Buffer.from(JSON.stringify(payload))
  return publishChannel.publish(EXCHANGE, routingKey, buffer, {
    persistent: true,
    contentType: 'application/json',
    timestamp: Date.now(),
  })
}

export function publishAuthAccountCreated(payload: Record<string, unknown>): boolean {
  return publish(OUTBOUND_KEYS.authAccountCreated, payload)
}

export function publishPasswordResetRequested(payload: Record<string, unknown>): boolean {
  return publish(OUTBOUND_KEYS.passwordResetRequested, payload)
}

export function publishMfaEnabled(payload: Record<string, unknown>): boolean {
  return publish(OUTBOUND_KEYS.mfaEnabled, payload)
}

// ═══════════════════════════════════════════════════════════════
// CONSUME
// ═══════════════════════════════════════════════════════════════

export async function consume(
  queueName: string,
  handler: (routingKey: string, payload: Record<string, unknown>, raw: ConsumeMessage) => Promise<void>,
  prefetch?: number,
): Promise<void> {
  if (!connection) {
    throw new Error('RabbitMQ not connected — call connectBus() first')
  }

  const ch = await connection.createChannel()
  await ch.prefetch(prefetch ?? config.rabbitmqPrefetch)

  await ch.consume(queueName, async (msg) => {
    if (!msg) return

    try {
      const payload = JSON.parse(msg.content.toString()) as Record<string, unknown>
      await handler(msg.fields.routingKey, payload, msg)
      ch.ack(msg)
    } catch (err) {
      logger.error('Queue message processing error', {
        queue: queueName,
        routingKey: msg.fields.routingKey,
        error: err instanceof Error ? err.message : 'unknown',
      })
      ch.nack(msg, false, !msg.fields.redelivered)
    }
  })

  logger.info('Consuming queue', { queue: queueName, prefetch: prefetch ?? config.rabbitmqPrefetch })
}

export { EXCHANGE }
