/**
 * SPIS IAM Service — Registry Service Client
 *
 * HTTP client to the family/registry service (port 3001).
 * Used for national_id (TRN) lookups during password reset.
 */

import axios from 'axios'
import { config } from '../config.js'
import { logger } from './logger.js'

const client = axios.create({
  baseURL: config.registryServiceUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export interface RegistryLookupResult {
  registry_id: string
  email: string | null
  phone?: string | null
  family_uuid?: string | null
  family_id?: string | null
  member_uuid?: string | null
  member_id?: string | null
  national_id?: string | null
  first_name?: string
  last_name?: string
}

/**
 * Look up a person in the Registry by national_id (TRN).
 * Returns registry_id + email if found and approved.
 * Returns null if not found.
 */
export async function lookupByNationalId(nationalId: string): Promise<RegistryLookupResult | null> {
  try {
    const res = await client.get('/api/v1/public/members/lookup', {
      params: { national_id: nationalId },
    })

    const body = (res.data?.data || res.data) as Partial<RegistryLookupResult> | undefined
    // Accept registry_id OR the refactored family-service fields (uuid / member_id)
    const registryId = body?.registry_id || body?.member_uuid || (body as Record<string, unknown>)?.['uuid'] as string | undefined
    if (registryId) {
      logger.info('Registry lookup success', { registry_id: registryId })
      return {
        registry_id: registryId,
        email: body?.email || null,
        phone: body?.phone || null,
        family_uuid: body?.family_uuid || null,
        family_id: body?.family_id || null,
        member_uuid: body?.member_uuid || (body as Record<string, unknown>)?.['uuid'] as string | undefined || null,
        member_id: body?.member_id || null,
        national_id: body?.national_id || null,
        first_name: body?.first_name,
        last_name: body?.last_name,
      }
    }

    return null
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      logger.info('Registry lookup — national_id not found')
      return null
    }
    const msg = axios.isAxiosError(err)
      ? `Registry Service error: ${err.response?.status} ${err.message}`
      : (err as Error).message
    logger.error('Registry lookup failed', { error: msg })
    throw new Error(msg)
  }
}

/**
 * Check if Registry Service is reachable.
 */
export async function registryServiceHealthy(): Promise<boolean> {
  try {
    const res = await client.get('/health')
    return res.status === 200
  } catch {
    return false
  }
}
