import jwt from "jsonwebtoken";

if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is required but not set.");
}

const JWT_SECRET = process.env.AUTH_SECRET;

export interface TokenPayload {
  userId: string;
  role: string;
  barberCode: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Reads the auth cookie, verifies it, and optionally checks the role.
 * Returns the payload on success, or null if unauthenticated/unauthorized —
 * callers should return a 401 when null is returned.
 */
export async function requireAuth(allowedRoles?: string[]): Promise<TokenPayload | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;
  if (allowedRoles && !allowedRoles.includes(payload.role)) return null;

  return payload;
}
