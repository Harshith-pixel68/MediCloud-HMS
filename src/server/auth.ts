import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUserProfile } from './types.ts';

interface TokenPayload {
  sub: number;
  email: string;
  fullName: string;
  role: 'Administrator' | 'Staff';
  jti: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUserProfile;
  authToken?: string;
}

const revokedTokenIds = new Map<string, number>();

function pruneRevokedTokens(): void {
  const now = Date.now();
  for (const [jti, exp] of revokedTokenIds.entries()) {
    if (exp <= now) {
      revokedTokenIds.delete(jti);
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}

export function timingSafeStringMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function signSessionToken(
  user: AuthUserProfile,
  secret: string,
  ttlMs = 8 * 60 * 60 * 1000
): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    jti: crypto.randomUUID(),
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  if (!timingSafeStringMatch(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TokenPayload;

    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      return null;
    }

    pruneRevokedTokens();
    if (revokedTokenIds.has(parsed.jti)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function revokeSessionToken(token: string, secret: string): void {
  const payload = verifySessionToken(token, secret);
  if (payload) {
    revokedTokenIds.set(payload.jti, payload.exp);
  }
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : null;
}

export function createRequireAuth(sessionSecret: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const payload = verifySessionToken(token, sessionSecret);
    if (!payload) {
      res.status(401).json({ error: 'Session is invalid or expired. Please sign in again.' });
      return;
    }

    req.authUser = {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
    };
    req.authToken = token;
    next();
  };
}
