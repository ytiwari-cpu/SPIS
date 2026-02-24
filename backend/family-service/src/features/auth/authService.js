/**
 * AuthService — IAM proxy + family data enrichment
 */

const IAM_SERVICE_URL = process.env.IAM_SERVICE_URL || 'http://localhost:3003'

function normalizeNationalId(value) {
  return value.replace(/\D/g, '')
}

async function authenticateWithIAM(nationalId, password) {
  try {
    const response = await fetch(`${IAM_SERVICE_URL}/iam/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ national_id: nationalId, password }),
    })
    const json = await response.json()
    if (!response.ok) {
      const errObj = json.error
      return { ok: false, error: String(errObj?.message || json.message || 'Authentication failed') }
    }
    return { ok: true, data: json.data }
  } catch (err) {
    return { ok: false, error: `IAM service unavailable: ${err.message}` }
  }
}

export class AuthService {
  /** @param {import('./authRepository.js').AuthRepository} repo */
  constructor(repo) {
    this.repo = repo
  }

  async login(nationalIdRaw, password) {
    const cleanNationalId = normalizeNationalId(nationalIdRaw)
    if (cleanNationalId.length !== 14) throw new Error('national_id must contain exactly 14 digits')

    const tokenResult = await authenticateWithIAM(cleanNationalId, password)
    if (!tokenResult.ok || !tokenResult.data) {
      return { authFailed: true, error: tokenResult.error || 'Invalid credentials' }
    }

    const baseAuthData = {
      auth_mode:    'iam_national_id',
      national_id:  cleanNationalId,
      access_token: tokenResult.data.access_token,
      token_type:   tokenResult.data.token_type,
      expires_in:   tokenResult.data.expires_in,
      user_id:      tokenResult.data.user_id,
      email:        tokenResult.data.email,
      roles:        tokenResult.data.roles        || [],
      permissions:  tokenResult.data.permissions  || [],
    }

    const { data: member } = await this.repo.getMemberByNationalId(cleanNationalId)
    if (!member) return { data: baseAuthData }

    const { data: family } = await this.repo.getFamilyByUuid(member.family_uuid)
    if (!family) return { data: baseAuthData }

    return {
      data: {
        ...baseAuthData,
        uuid: family.uuid, family_id: family.family_id, status: family.status,
        registration_status: family.registration_status, household_size: family.household_size,
        created_at: family.created_at,
      },
    }
  }

  async proxyOtpLoginRequest(nationalIdRaw) {
    const cleanNationalId = normalizeNationalId(nationalIdRaw)
    const response = await fetch(`${IAM_SERVICE_URL}/iam/otp-login/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ national_id: cleanNationalId }),
    })
    const json = await response.json()
    return { status: response.ok ? 200 : response.status, json }
  }

  async verifyOtpLogin(nationalIdRaw, otp) {
    const cleanNationalId = normalizeNationalId(nationalIdRaw)
    const iamResponse = await fetch(`${IAM_SERVICE_URL}/iam/otp-login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ national_id: cleanNationalId, otp }),
    })
    const iamJson = await iamResponse.json()
    if (!iamResponse.ok) return { failed: true, status: iamResponse.status, json: iamJson }

    const tokenData = iamJson.data
    if (!tokenData) return { failed: true, status: 500, json: { success: false, error: 'Invalid response from IAM service' } }

    const permissions = tokenData.permissions || []
    const hasAdminPermissions = permissions.some(p => p.startsWith('ADMIN.'))
    if (hasAdminPermissions) {
      return {
        data: {
          auth_mode: 'iam_national_id', national_id: cleanNationalId,
          access_token: tokenData.access_token, user_id: tokenData.user_id,
          email: tokenData.email, roles: tokenData.roles, permissions: tokenData.permissions,
          is_staff: true, is_new_user: tokenData.is_new_user,
        },
      }
    }

    const { data: member, error: memberError } = await this.repo.getMemberByNationalId(cleanNationalId)
    if (memberError || !member) return { memberNotFound: true }

    const { data: family, error: familyError } = await this.repo.getFamilyByUuid(member.family_uuid)
    if (familyError || !family) return { familyNotFound: true }

    return {
      data: {
        uuid: family.uuid, family_id: family.family_id, status: family.status,
        registration_status: family.registration_status, household_size: family.household_size,
        created_at: family.created_at, auth_mode: 'iam_national_id', national_id: cleanNationalId,
        access_token: tokenData.access_token, token_type: tokenData.token_type,
        expires_in: tokenData.expires_in, roles: tokenData.roles, permissions: tokenData.permissions,
        user_id: tokenData.user_id, is_new_user: tokenData.is_new_user,
      },
    }
  }

  async me(authHeader, familyIdHeader) {
    let memberNationalId = null
    let jwtPayload = null

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7)
        const payloadB64 = token.split('.')[1]
        if (payloadB64) {
          jwtPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
          if (jwtPayload?.national_id) memberNationalId = jwtPayload.national_id
        }
      } catch (_err) { /* ignore */ }
    }

    if (!jwtPayload) return { unauthenticated: true }

    const baseUserData = {
      user_id:     jwtPayload.sub,
      email:       jwtPayload.email,
      national_id: jwtPayload.national_id || null,
      roles:       jwtPayload.roles        || [],
      permissions: jwtPayload.permissions  || [],
    }

    let familyUuid = null
    if (memberNationalId) {
      const { data: member } = await this.repo.getMemberByNationalId(memberNationalId)
      if (member) familyUuid = member.family_uuid
    }

    if (!familyUuid && familyIdHeader) {
      const { data: fam } = await this.repo.getFamilyByFamilyId(familyIdHeader)
      if (fam) familyUuid = fam.uuid
    }

    if (!familyUuid) return { data: { ...baseUserData, no_family: true } }

    const { data: family, error } = await this.repo.getFamilyFullByUuid(familyUuid)
    if (error || !family) return { data: { ...baseUserData, no_family: true } }

    const { data: headMember } = await this.repo.getHeadMemberByFamily(family.uuid)

    return { data: { ...baseUserData, ...family, head_member: headMember || null } }
  }
}
