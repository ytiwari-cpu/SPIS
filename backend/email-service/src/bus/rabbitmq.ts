/**
 * SPIS Email Service — RabbitMQ Bus
 *
 * Topology:
 *   Exchange: spis.events (type=topic, durable)
 *   Queues:
 *     email.send          ← routing key: email.send
 *     email.sent.audit    ← routing key: email.sent
 *     email.failed.alerts ← routing key: email.failed
 *
 * Provides publish() and consume() helpers.
 */

import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

let connection: ChannelModel | null = null
let publishChannel: Channel | null = null

const EXCHANGE = config.rabbitmqExchange  // 'spis.events'
const QUEUES = {
  send: 'email.send',
  sent: 'email.sent.audit',
  failed: 'email.failed.alerts',
} as const

const ROUTING_KEYS = {
  send: 'email.send',
  sent: 'email.sent',
  failed: 'email.failed',
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

    // Declare exchange
    await publishChannel.assertExchange(EXCHANGE, 'topic', { durable: true })

    // Declare queues and bind
    for (const [key, queue] of Object.entries(QUEUES)) {
      await publishChannel.assertQueue(queue, { durable: true })
      await publishChannel.bindQueue(queue, EXCHANGE, ROUTING_KEYS[key as keyof typeof ROUTING_KEYS])
    }

    logger.info('RabbitMQ connected', { exchange: EXCHANGE, queues: Object.values(QUEUES) })
  } catch (err) {
    logger.error('RabbitMQ connection failed', { error: err instanceof Error ? err.message : 'unknown' })
    // Retry in 5s
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
    messageId: (payload.request_id as string) || undefined,
    timestamp: Date.now(),
  })
}

/** Convenience: publish to email.send */
export function publishEmailSend(payload: Record<string, unknown>): boolean {
  return publish(ROUTING_KEYS.send, payload)
}

/** Convenience: publish to email.sent */
export function publishEmailSent(payload: Record<string, unknown>): boolean {
  return publish(ROUTING_KEYS.sent, payload)
}

/** Convenience: publish to email.failed */
export function publishEmailFailed(payload: Record<string, unknown>): boolean {
  return publish(ROUTING_KEYS.failed, payload)
}

// ═══════════════════════════════════════════════════════════════
// CONSUME
// ═══════════════════════════════════════════════════════════════

export async function consume(
  queueName: string,
  handler: (msg: Record<string, unknown>, raw: ConsumeMessage) => Promise<void>,
  prefetch?: number
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
      await handler(payload, msg)
      ch.ack(msg)
    } catch (err) {
      logger.error('Queue message processing error', {
        queue: queueName,
        error: err instanceof Error ? err.message : 'unknown',
      })
      // Negative ack — requeue once, then dead-letter
      ch.nack(msg, false, !msg.fields.redelivered)
    }
  })

  logger.info('Consuming queue', { queue: queueName, prefetch: prefetch ?? config.rabbitmqPrefetch })
}

export { QUEUES, ROUTING_KEYS, EXCHANGE }
