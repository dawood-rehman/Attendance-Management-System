import { jwtVerify } from 'jose';
import type { JWTPayload } from './jwt';

const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return new TextEncoder().encode(JWT_SECRET);
}

export async function verifyEdgeToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());

  return {
    userId: String(payload.userId || ''),
    email: String(payload.email || ''),
    role: String(payload.role || ''),
    status: String(payload.status || ''),
    mustChangePassword: Boolean(payload.mustChangePassword),
  };
}
