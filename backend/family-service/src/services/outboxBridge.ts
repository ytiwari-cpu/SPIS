import {
  getUnpublishedEvents,
  markEventsFailed,
  markEventsPublished,
} from './eventService.js'

type OutboxRow = {
  event_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

type RoutedMessage = {
  routingKey: string
  payload: Record<string, unknown>
}

const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'
const exchange = process.env.RABBITMQ_EXCHANGE || 'spis.events'
const pollIntervalMs = parseInt(process.env.OUTBOX_BRIDGE_POLL_MS || '3000', 10)
const batchSize = parseInt(process.env.OUTBOX_BRIDGE_BATCH_SIZE || '50', 10)

let connection: ChannelModel | null = null
let channel: Channel | null = null
let isProcessing = false

type Channel = {
  assertExchange: (exchangeName: string, kind: string, opts?: Record<string, unknown>) => Promise<unknown>
  publish: (exchangeName: string, routingKey: string, content: Buffer, opts?: Record<string, unknown>) => boolean
}

type ChannelModel = {
  createChannel: () => Promise<Channel>
  on: (event: 'close', cb: () => void) => void
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function normalizeNationalId(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits || null
}

function deriveRegistryId(payload: Record<string, unknown>): string | null {
  const data = asObject(payload.data)
  return (
    asString(payload.entity_id) ||
    asString(data.member_uuid) ||
    normalizeNationalId(data.national_id) ||
    normalizeNationalId(payload.national_id)
  )
}

function mapEvent(row: OutboxRow): RoutedMessage | null {
  const payload = asObject(row.payload)
  const data = asObject(payload.data)
  const registryId = deriveRegistryId(payload)

  if (!registryId) return null

  const nationalId = normalizeNationalId(data.national_id) || normalizeNationalId(payload.national_id)
  const email = asString(data.email) || asString(payload.email)
  const phone = asString(data.phone) || asString(payload.phone)

  switch (row.event_type) {
    case 'member.added':
      if (!nationalId || !email) return null
      return {
        routingKey: 'registry.events.CREATE_AUTH_ACCOUNT',
        payload: {
          registry_id: registryId,
          email,
          national_id: nationalId,
        },
      }

    case 'member.updated':
      if (!email && !phone) return null
      return {
        routingKey: 'registry.events.USER_CONTACT_UPDATED',
        payload: {
          registry_id: registryId,
          email: email || undefined,
          phone: phone || undefined,
        },
      }

    case 'member.removed':
    case 'member.deleted':
      return {
        routingKey: 'registry.events.USER_DELETED',
        payload: { registry_id: registryId },
      }

    case 'member.status_changed': {
      const newStatus = asString(data.new_status)?.toUpperCase()
      if (newStatus === 'DECEASED' || newStatus === 'TRANSFERRED_OUT') {
        return {
          routingKey: 'registry.events.USER_DELETED',
          payload: { registry_id: registryId },
        }
      }
      return null
    }

    default:
      return null
  }
}

async function ensureRabbitConnected(): Promise<void> {
  if (connection && channel) return

  const amqp = await loadAmqpClient()
  const connectFn = amqp.connect || amqp.default?.connect
  if (!connectFn) {
    throw new Error('Unable to resolve amqplib connect()')
  }

  connection = await connectFn(rabbitmqUrl) as ChannelModel
  channel = await connection.createChannel()
  await channel.assertExchange(exchange, 'topic', { durable: true })

  connection.on('close', () => {
    connection = null
    channel = null
  })
}

async function loadAmqpClient(): Promise<any> {
  const moduleName = 'amqplib'
  try {
    return await import(moduleName)
  } catch {
    const fallbackPath = '../../../iam-service/node_modules/amqplib/channel_api.js'
    return await import(fallbackPath)
  }
}

async function publishMessage(message: RoutedMessage): Promise<boolean> {
  if (!channel) return false
  return channel.publish(
    exchange,
    message.routingKey,
    Buffer.from(JSON.stringify(message.payload)),
    {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    },
  )
}

async function processOutboxBatch(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    await ensureRabbitConnected()

    const result = await getUnpublishedEvents(batchSize)
    if (!result.success || !result.data || result.data.length === 0) {
      return
    }

    const eventIdsToMarkPublished: string[] = []
    const eventIdsToMarkFailed: string[] = []

    for (const rawRow of result.data) {
      const row: OutboxRow = {
        event_id: rawRow.event_id,
        event_type: rawRow.event_type,
        payload: asObject(rawRow.payload),
        created_at: rawRow.created_at,
      }

      const mapped = mapEvent(row)
      if (!mapped) {
        // If an event is irrelevant for IAM bridge, mark it processed.
        eventIdsToMarkPublished.push(row.event_id)
        continue
      }

      const published = await publishMessage(mapped)
      if (published) {
        eventIdsToMarkPublished.push(row.event_id)
      } else {
        eventIdsToMarkFailed.push(row.event_id)
      }
    }

    if (eventIdsToMarkPublished.length > 0) {
      await markEventsPublished(eventIdsToMarkPublished)
    }
    if (eventIdsToMarkFailed.length > 0) {
      await markEventsFailed(eventIdsToMarkFailed, 'RabbitMQ publish returned false')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    console.error('Outbox bridge batch failed:', message)
    connection = null
    channel = null
  } finally {
    isProcessing = false
  }
}

export async function startOutboxBridge(): Promise<void> {
  console.log('Starting outbox-to-Rabbit bridge...')
  console.log(`RabbitMQ: ${rabbitmqUrl}`)
  console.log(`Exchange: ${exchange}`)
  console.log(`Poll interval: ${pollIntervalMs}ms`)
  console.log(`Batch size: ${batchSize}`)

  await processOutboxBatch()
  setInterval(() => {
    processOutboxBatch().catch((err) => {
      console.error('Outbox bridge tick failed:', err)
    })
  }, pollIntervalMs)
}
