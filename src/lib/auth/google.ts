import crypto from 'crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export type GoogleMode = 'login' | 'register';
export type GoogleRegisterRole = 'teacher' | 'student';

export interface GoogleState {
  mode: GoogleMode;
  role?: GoogleRegisterRole;
  ts: number;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

function secret() {
  return process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'attendance-google-oauth-secret';
}

function hasRealValue(value: string | undefined) {
  return Boolean(value && !value.startsWith('your_'));
}

function sign(value: string) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createGoogleState(input: Omit<GoogleState, 'ts'>) {
  const payload = Buffer.from(JSON.stringify({ ...input, ts: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readGoogleState(state: string | null): GoogleState | null {
  if (!state) return null;
  const [payload, signature] = state.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GoogleState;
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    if (!['login', 'register'].includes(parsed.mode)) return null;
    if (parsed.role && !['teacher', 'student'].includes(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function googleRedirectUri(origin: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || origin;
  return `${appUrl.replace(/\/$/, '')}/api/auth/google/callback`;
}

export function googleAuthUrl(origin: string, state: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!hasRealValue(clientId)) return null;
  const safeClientId = clientId as string;

  const params = new URLSearchParams({
    client_id: safeClientId,
    redirect_uri: googleRedirectUri(origin),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function getGoogleProfile(code: string, origin: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!hasRealValue(clientId) || !hasRealValue(clientSecret)) {
    throw new Error('Google OAuth is not configured');
  }
  const safeClientId = clientId as string;
  const safeClientSecret = clientSecret as string;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: safeClientId,
      client_secret: safeClientSecret,
      redirect_uri: googleRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error('Google token exchange failed');
  }

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const profile = await profileRes.json();
  if (!profileRes.ok || !profile.sub || !profile.email) {
    throw new Error('Could not read Google profile');
  }

  return profile as GoogleProfile;
}
