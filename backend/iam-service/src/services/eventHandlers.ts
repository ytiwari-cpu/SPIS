/**
 * SPIS IAM Service — Event Handlers
 *
 * Consumes events from the iam.registry queue:
 *   - registry.events.CREATE_AUTH_ACCOUNT → create account + invite
 *   - registry.events.USER_CONTACT_UPDATED → update email/phone
 *   - registry.events.USER_DELETED → disable account, revoke sessions
 */

import { createLogger } from '../../../base/logger.js'
import { createConnection } from '../../../base/db/createConnection.js'
import { createClient } from '@supabase/supabase-js'
const logger = createLogger('iam-service')
import { INBOUND_KEYS, connectBus, consume, QUEUES, closeBus } from '../bus/rabbitmq.js'
import { hashNationalId } from '../lib/crypto.js'
import { invalidateUserCache } from '../lib/redis.js'
import { InviteService } from '../features/invite/inviteService.js'
import type {
  CreateAuthAccountEvent, UserContactUpdatedEvent, UserDeletedEvent,
} from '../types.js'

// ── Worker DB connection (inside function so dotenv has loaded) ────────────
let workerConnection: ReturnType<typeof createConnection>

function getConnection() {
  if (!workerConnection) {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('[YOUR_PASSWORD]')) {
      workerConnection = createConnection({ connectionString: process.env.DATABASE_URL })
    } else {
      const supabaseClient = createClient(
        (process.env.IAM_SUPABASE_URL || process.env.SUPABASE_URL)!,
        (process.env.IAM_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
      )
      workerConnection = createConnection({ supabaseClient })
    }
  }
  return workerConnection
}

/** Create a minimal worker context (no HTTP request). */
function createWorkerContext() {
  const conn = getConnection()
  return { connection: conn, user: null, request: null, response: null, logger: logger }
}

// ── Inline DB helpers for worker (no HTTP context needed) ──────────────────

async function getUserByRegistryId(registryId: string) {
  const result = await getConnection().query(
    'SELECT * FROM users WHERE registry_id = $1 LIMIT 1',
    [registryId],
  )
  return result.rows[0] ?? null
}

async function updateUserEmail(userId: string, email: string) {
  await getConnection().query(
    'UPDATE users SET email = $1, updated_at = NOW() WHERE user_id = $2',
    [email, userId],
  )
}

async function disableUser(userId: string) {
  await getConnection().query(
    "UPDATE users SET status = 'disabled', updated_at = NOW() WHERE user_id = $1",
    [userId],
  )
}

// ═══════════════════════════════════════════════════════════════
// ROUTER — dispatch by routing key
// ═══════════════════════════════════════════════════════════════

async function handleMessage(
  routingKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  logger.info('Event received', { routingKey, payload })

  switch (routingKey) {
    case INBOUND_KEYS.createAuthAccount:
      await handleCreateAuthAccount(payload as unknown as CreateAuthAccountEvent)
      break

    case INBOUND_KEYS.userContactUpdated:
      await handleUserContactUpdated(payload as unknown as UserContactUpdatedEvent)
      break

    case INBOUND_KEYS.userDeleted:
      await handleUserDeleted(payload as unknown as UserDeletedEvent)
      break

    default:
      logger.warn('Unknown routing key', { routingKey })
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER: CREATE_AUTH_ACCOUNT
// ═══════════════════════════════════════════════════════════════

async function handleCreateAuthAccount(event: CreateAuthAccountEvent): Promise<void> {
  const { registry_id, email, national_id_hash, national_id } = event

  if (!registry_id || !email) {
    logger.error('CREATE_AUTH_ACCOUNT missing required fields', { event: event as unknown as Record<string, unknown> })
    return
  }

  try {
    const derivedHash = national_id_hash || (national_id ? hashNationalId(national_id) : undefined)
    const ctx           = createWorkerContext()
    const inviteService = new InviteService(ctx as any)
    await inviteService.createInvitedAccount({
      registryId: registry_id,
      email,
      nationalIdHash: derivedHash,
    })
  } catch (err) {
    logger.error('Failed to handle CREATE_AUTH_ACCOUNT', {
      registry_id,
      error: (err as Error).message,
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER: USER_CONTACT_UPDATED
// ═══════════════════════════════════════════════════════════════

async function handleUserContactUpdated(event: UserContactUpdatedEvent): Promise<void> {
  const { registry_id, email } = event

  if (!registry_id) {
    logger.error('USER_CONTACT_UPDATED missing registry_id')
    return
  }

  const user = await getUserByRegistryId(registry_id)
  if (!user) {
    logger.warn('USER_CONTACT_UPDATED — no IAM user for registry_id', { registry_id })
    return
  }

  try {
    // Update email in IAM DB
    if (email && email !== user.email) {
      await updateUserEmail(user.user_id, email)

      logger.info('User email updated via event', {
        user_id: user.user_id,
        registry_id,
      })
    }
  } catch (err) {
    logger.error('Failed to handle USER_CONTACT_UPDATED', {
      registry_id,
      error: (err as Error).message,
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER: USER_DELETED
// ═══════════════════════════════════════════════════════════════

async function handleUserDeleted(event: UserDeletedEvent): Promise<void> {
  const { registry_id } = event

  if (!registry_id) {
    logger.error('USER_DELETED missing registry_id')
    return
  }

  const user = await getUserByRegistryId(registry_id)
  if (!user) {
    logger.warn('USER_DELETED — no IAM user for registry_id', { registry_id })
    return
  }

  try {
    // 1. Disable in IAM DB
    await disableUser(user.user_id)

    // 2. Invalidate Redis cache
    await invalidateUserCache(user.user_id, registry_id)

    logger.info('User disabled via USER_DELETED event', {
      user_id: user.user_id,
      registry_id,
    })
  } catch (err) {
    logger.error('Failed to handle USER_DELETED', {
      registry_id,
      error: (err as Error).message,
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// WORKER STARTUP
// ═══════════════════════════════════════════════════════════════

export async function startEventWorker(): Promise<void> {
  logger.info('Starting IAM event worker...')
  await connectBus()
  await consume(QUEUES.iamRegistry, handleMessage)
  logger.info('IAM event worker running', { queue: QUEUES.iamRegistry })
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('IAM event worker shutting down...')
  await closeBus()
  if (workerConnection) await workerConnection.end()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
