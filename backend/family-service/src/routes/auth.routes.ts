import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

const IAM_SERVICE_URL = process.env.IAM_SERVICE_URL || 'http://localhost:3003'

function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Call IAM service to authenticate with national_id + password.
 * Returns JWT token + user info on success.
 */
async function authenticateWithIAM(
  nationalId: string,
  password: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const response = await fetch(`${IAM_SERVICE_URL}/iam/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ national_id: nationalId, password }),
    })

    const json = await response.json() as Record<string, unknown>

    if (!response.ok) {
      const errObj = json.error as Record<string, unknown> | undefined
      return {
        ok: false,
        error: String(errObj?.message || json.message || 'Authentication failed'),
      }
    }

    return { ok: true, data: json.data as Record<string, unknown> }
  } catch (err) {
    return {
      ok: false,
      error: `IAM service unavailable: ${(err as Error).message}`,
    }
  }
}

/**
 * POST /api/v1/auth/login
 *
 * Authenticate with national_id + password via IAM service.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { national_id, password } = req.body as {
      national_id?: string
      password?: string
    }

    if (!national_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'national_id and password are required',
      })
    }
    const cleanNationalId = normalizeNationalId(national_id)
    if (cleanNationalId.length !== 14) {
      return res.status(400).json({
        success: false,
        error: 'national_id must contain exactly 14 digits',
      })
    }

    // 1. Authenticate via IAM service first
    const tokenResult = await authenticateWithIAM(cleanNationalId, password)
    if (!tokenResult.ok || !tokenResult.data) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Invalid credentials',
      })
    }

    // 2. Check if user is a worker (SuperAdmin, Admin, CaseWorker) - they don't need family
    const roles = (tokenResult.data.roles as string[]) || []
    const isWorker = roles.some(role =>
      role === 'SuperAdmin' || role === 'Admin' || role === 'CaseWorker' || role === 'ProgrammeManager'
    )

    if (isWorker) {
      // Workers don't have family records - return just the auth token
      return res.json({
        success: true,
        data: {
          auth_mode: 'iam_national_id',
          national_id: cleanNationalId,
          access_token: tokenResult.data.access_token,
          user_id: tokenResult.data.user_id,
          email: tokenResult.data.email,
          roles: tokenResult.data.roles,
          is_worker: true,
        },
      })
    }

    // 3. For Citizens: Look up member in family DB to get family info
    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .select('*')
      .eq('national_id', cleanNationalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (memberError || !member) {
      return res.status(404).json({
        success: false,
        error: 'No family registration found for this user. Please register your family first.',
      })
    }

    // 4. Look up family
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', member.family_uuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found for authenticated member',
      })
    }
    return res.json({
      success: true,
      data: {
        uuid: family.uuid,
        family_id: family.family_id,
        status: family.status,
        registration_status: family.registration_status,
        household_size: family.household_size,
        created_at: family.created_at,
        auth_mode: 'iam_national_id',
        national_id: cleanNationalId,
        access_token: tokenResult.data.access_token,
        token_type: tokenResult.data.token_type,
        expires_in: tokenResult.data.expires_in,
        roles: tokenResult.data.roles,
        permissions: tokenResult.data.permissions,
        user_id: tokenResult.data.user_id,
      },
    })
  } catch (error) {
    console.error('Auth login error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * POST /api/v1/auth/otp-login/request
 *
 * Proxy to IAM service OTP login request (pass-through).
 */
router.post('/otp-login/request', async (req: Request, res: Response) => {
  try {
    const { national_id } = req.body as { national_id?: string }

    if (!national_id) {
      return res.status(400).json({
        success: false,
        error: 'national_id is required',
      })
    }

    const cleanNationalId = normalizeNationalId(national_id)

    const response = await fetch(`${IAM_SERVICE_URL}/iam/otp-login/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ national_id: cleanNationalId }),
    })

    const json = await response.json() as Record<string, unknown>

    if (!response.ok) {
      return res.status(response.status).json(json)
    }

    return res.json(json)
  } catch (error) {
    console.error('OTP login request proxy error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * POST /api/v1/auth/otp-login/verify
 *
 * Proxy to IAM service OTP login verify, then enrich with family data
 * (same approach as POST /login for password-based auth).
 */
router.post('/otp-login/verify', async (req: Request, res: Response) => {
  try {
    const { national_id, otp } = req.body as { national_id?: string; otp?: string }

    if (!national_id || !otp) {
      return res.status(400).json({
        success: false,
        error: 'national_id and otp are required',
      })
    }

    const cleanNationalId = normalizeNationalId(national_id)

    // 1. Verify OTP via IAM service
    const iamResponse = await fetch(`${IAM_SERVICE_URL}/iam/otp-login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ national_id: cleanNationalId, otp }),
    })

    const iamJson = await iamResponse.json() as Record<string, unknown>

    if (!iamResponse.ok) {
      return res.status(iamResponse.status).json(iamJson)
    }

    const tokenData = iamJson.data as Record<string, unknown>
    if (!tokenData) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response from IAM service',
      })
    }

    // 2. Check if user is a worker — they don't need family enrichment
    const roles = (tokenData.roles as string[]) || []
    const isWorker = roles.some(role =>
      role === 'SuperAdmin' || role === 'Admin' || role === 'CaseWorker' || role === 'ProgrammeManager'
    )

    if (isWorker) {
      return res.json({
        success: true,
        data: {
          auth_mode: 'iam_national_id',
          national_id: cleanNationalId,
          access_token: tokenData.access_token,
          user_id: tokenData.user_id,
          email: tokenData.email,
          roles: tokenData.roles,
          is_worker: true,
          is_new_user: tokenData.is_new_user,
        },
      })
    }

    // 3. For Citizens: Look up member in family DB to get family info
    const { data: member, error: memberError } = await supabase
      .from('family_member')
      .select('*')
      .eq('national_id', cleanNationalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (memberError || !member) {
      return res.status(404).json({
        success: false,
        error: 'No family registration found for this user. Please register your family first.',
      })
    }

    // 4. Look up family
    const { data: family, error: familyError } = await supabase
      .from('family')
      .select('*')
      .eq('uuid', member.family_uuid)
      .single()

    if (familyError || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found for authenticated member',
      })
    }

    return res.json({
      success: true,
      data: {
        uuid: family.uuid,
        family_id: family.family_id,
        status: family.status,
        registration_status: family.registration_status,
        household_size: family.household_size,
        created_at: family.created_at,
        auth_mode: 'iam_national_id',
        national_id: cleanNationalId,
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        roles: tokenData.roles,
        permissions: tokenData.permissions,
        user_id: tokenData.user_id,
        is_new_user: tokenData.is_new_user,
      },
    })
  } catch (error) {
    console.error('OTP login verify proxy error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

/**
 * Get current session/family info.
 * For Citizens: returns family info via JWT token (national_id claim) or X-Family-ID header.
 * For Workers: returns user info from JWT without family data.
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    let familyUuid: string | null = null
    let memberNationalId: string | null = null
    let jwtPayload: Record<string, unknown> | null = null

    // 1. Try JWT token first — extract payload
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        // Decode JWT payload (already verified by middleware if protected,
        // but /auth/* is public so we decode manually here)
        const token = authHeader.slice(7)
        const payloadB64 = token.split('.')[1]
        if (payloadB64) {
          jwtPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
          console.log('[/auth/me] Decoded JWT payload:', {
            sub: jwtPayload?.sub,
            email: jwtPayload?.email,
            roles: jwtPayload?.roles,
            national_id: jwtPayload?.national_id,
          })
          if (jwtPayload?.national_id) {
            memberNationalId = jwtPayload.national_id as string
          }
        }
      } catch (err) {
        console.log('[/auth/me] Error decoding JWT:', err)
      }
    } else {
      console.log('[/auth/me] No Authorization header found')
    }

    // 2. Check if user is a worker (SuperAdmin, Admin, CaseWorker, ProgrammeManager)
    if (jwtPayload) {
      const roles = (jwtPayload.roles as string[]) || []
      const isWorker = roles.some(role =>
        role === 'SuperAdmin' || role === 'Admin' || role === 'CaseWorker' || role === 'ProgrammeManager'
      )

      if (isWorker) {
        // Workers don't have family records - return user info from JWT
        return res.json({
          success: true,
          data: {
            user_id: jwtPayload.sub,
            email: jwtPayload.email,
            roles: jwtPayload.roles,
            permissions: jwtPayload.permissions,
            is_worker: true,
          },
        })
      }
    }

    // 3. For Citizens: Look up member by national_id from JWT
    if (memberNationalId) {
      console.log('[/auth/me] Looking up family_member with national_id:', memberNationalId)
      const { data: member, error: memberError } = await supabase
        .from('family_member')
        .select('family_uuid')
        .eq('national_id', memberNationalId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('[/auth/me] family_member lookup result:', { member, memberError })

      if (member) {
        familyUuid = member.family_uuid
      } else {
        console.log('[/auth/me] No family_member found for national_id:', memberNationalId)
      }
    } else {
      console.log('[/auth/me] No national_id found in JWT')
    }

    // 4. Fallback: X-Family-ID header (human-readable family_id)
    if (!familyUuid) {
      const familyIdHeader = req.headers['x-family-id'] as string
      if (familyIdHeader) {
        const { data: fam } = await supabase
          .from('family')
          .select('uuid')
          .eq('family_id', familyIdHeader)
          .single()
        if (fam) {
          familyUuid = fam.uuid
        }
      }
    }

    if (!familyUuid) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated or no family found.',
      })
    }

    // 4. Fetch full family record
    console.log('[/auth/me] Fetching family with uuid:', familyUuid)
    const { data: family, error } = await supabase
      .from('family')
      .select(`
        uuid,
        family_id,
        head_member_id,
        household_size,
        geo_code,
        vulnerability_flag,
        status,
        intake_channel,
        registration_status,
        submitted_at,
        verified_at,
        created_at,
        updated_at
      `)
      .eq('uuid', familyUuid)
      .single()

    console.log('[/auth/me] Family lookup result:', { family: family ? 'found' : 'not found', error })

    if (error || !family) {
      return res.status(404).json({
        success: false,
        error: 'Family not found',
      })
    }

    const { data: headMember } = await supabase
      .from('family_member')
      .select('uuid, member_id, first_name, last_name, national_id')
      .eq('family_uuid', family.uuid)
      .eq('relationship_to_head', 'head')
      .single()

    return res.json({
      success: true,
      data: {
        ...family,
        head_member: headMember || null,
      },
    })
  } catch (error) {
    console.error('Auth me error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

router.post('/logout', async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Logged out successfully',
  })
})

export { router as authRouter }
