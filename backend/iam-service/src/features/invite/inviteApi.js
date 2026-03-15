/**
 * IAM — Invite API
 *
 * Route: POST /iam/invite
 */

import { z } from 'zod'
import { ApiSchema } from '../../../../base/apiSchema.js'
import { InviteController } from './inviteController.js'

// ── Inline Zod schemas ──────────────────────────────────────

export const InviteSchema = z.object({
  registry_id:      z.string().min(1, 'registry_id is required').max(255),
  email:            z.string().email('Invalid email address').max(255),
  national_id_hash: z.string().min(1).optional(),
  national_id:      z.string().min(1).max(50).optional(),
}).refine(
  (value) => Boolean(value.national_id_hash || value.national_id),
  { message: 'Either national_id_hash or national_id is required' },
)

const create = {
  path:    '/',
  verb:    'POST',
  handler: { controller: InviteController, method: 'create', arguments: ['request:body'] },
  request: { body: InviteSchema },
}

export const InviteApi = new ApiSchema({
  name:      'Invite',
  url:       '/iam/invite',
  endpoints: [create],
})
