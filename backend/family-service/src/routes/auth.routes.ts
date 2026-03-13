import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

const IAM_SERVICE_URL = process.env.IAM_SERVICE_URL || 'http://localhost:3003'

function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Call IAM service to authenticate with national_id + password via Keycloak.
 * Keycloak validates the password; IAM service returns a local HS256 JWT.
 */
async function authenticateWithIAM(
  nationalId: string,
  password: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const response = await fetch(`${IAM_SERVICE_URL}/iam/keycloak/login`, {
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
 * 
 * DESIGN PRINCIPLE: No role-name checks here. We simply:
 * 1. Authenticate via IAM (which returns roles + permissions)
 * 2. Optionally look up family data if user has one
 * 3. Return everything - let the FRONTEND use PERMISSIONS to decide UI
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

    // 1. Authenticate via IAM service
    const tokenResult = await authenticateWithIAM(cleanNationalId, password)
    if (!tokenResult.ok || !tokenResult.data) {
      return res.status(401).json({
        success: false,
        error: tokenResult.error || 'Invalid credentials',
      })
    }

    // 2. Build base auth response (ALWAYS include all auth data)
    const baseAuthData = {
      auth_mode: 'iam_national_id',
      national_id: cleanNationalId,
      access_token: tokenResult.data.access_token,
      token_type: tokenResult.data.token_type,
      expires_in: tokenResult.data.expires_in,
      user_id: tokenResult.data.user_id,
      email: tokenResult.data.email,
      roles: tokenResult.data.roles || [],
      permissions: tokenResult.data.permissions || [], // ALWAYS include permissions
    }

    // 3. Try to look up family data (optional - user may or may not have a family)
    const { data: member } = await supabase
      .from('family_member')
      .select('family_uuid')
      .eq('national_id', cleanNationalId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!member) {
      // No family registration - return auth data only
      return res.json({
        success: true,
        data: baseAuthData,
      })
    }

    // 4. Look up family details
    const { data: family } = await supabase
      .from('family')
      .select('uuid, family_id, status, registration_status, household_size, created_at')
      .eq('uuid', member.family_uuid)
      .single()

    if (!family) {
      // Member exists but family record missing - return auth data only
      return res.json({
        success: true,
        data: baseAuthData,
      })
    }

    // 5. Return auth data WITH family info
    return res.json({
      success: true,
      data: {
        ...baseAuthData,
        uuid: family.uuid,
        family_id: family.family_id,
        status: family.status,
        registration_status: family.registration_status,
        household_size: family.household_size,
        created_at: family.created_at,
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

    // 2. Check if user has admin permissions — staff users don't need family enrichment
    // NOTE: We check PERMISSIONS, not role names, for scalability
    const permissions = (tokenData.permissions as string[]) || []
    const hasAdminPermissions = permissions.some(p => p.startsWith('ADMIN.'))

    if (hasAdminPermissions) {
      return res.json({
        success: true,
        data: {
          auth_mode: 'iam_national_id',
          national_id: cleanNationalId,
          access_token: tokenData.access_token,
          user_id: tokenData.user_id,
          email: tokenData.email,
          roles: tokenData.roles,
          permissions: tokenData.permissions, // ALWAYS include permissions
          is_staff: true,
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
 * 
 * DESIGN PRINCIPLE: No role-name checks. We simply:
 * 1. Extract user info from JWT
 * 2. Optionally look up family data if user has one
 * 3. Return everything - let the FRONTEND use PERMISSIONS to decide UI
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    let memberNationalId: string | null = null
    let jwtPayload: Record<string, unknown> | null = null

    // 1. Extract JWT payload
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
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

    if (!jwtPayload) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated.',
      })
    }

    // 2. Build base user data from JWT (ALWAYS include all auth data)
    const baseUserData = {
      user_id: jwtPayload.sub,
      email: jwtPayload.email,
      national_id: jwtPayload.national_id || null,
      roles: jwtPayload.roles || [],
      permissions: jwtPayload.permissions || [], // ALWAYS include permissions
    }

    // 3. Try to look up family data (optional - user may or may not have a family)
    let familyUuid: string | null = null

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

    // 4. Fallback: X-Family-ID header
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

    // 5. No family found - return user data only
    if (!familyUuid) {
      return res.json({
        success: true,
        data: {
          ...baseUserData,
          no_family: true,
        },
      })
    }

    // 6. Fetch full family record
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
      return res.json({
        success: true,
        data: {
          ...baseUserData,
          no_family: true,
        },
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
        ...baseUserData,
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

/**
 * POST /api/v1/auth/set-initial-password
 *
 * Proxy to IAM service. Called by newly-onboarded citizens (who registered via OTP
 * and are setting their password for the first time through the forced modal).
 * The IAM service extracts the national_id from the Bearer JWT, looks up the
 * Keycloak account, and sets the chosen password.
 */
router.post('/set-initial-password', async (req: Request, res: Response) => {
  try {
    const iamResponse = await fetch(`${IAM_SERVICE_URL}/iam/otp-login/set-initial-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the citizen's Bearer token so IAM can read their national_id claim
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify(req.body),
    })
    const json = await iamResponse.json()
    return res.status(iamResponse.status).json(json)
  } catch (error) {
    console.error('set-initial-password proxy error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export { router as authRouter }
