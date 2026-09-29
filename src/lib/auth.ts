import jwt from "jsonwebtoken";

if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is required but not set.");
}

const JWT_SECRET = process.env.AUTH_SECRET;

export interface TokenPayload {
  userId: string;
  role: string;
  barberCode: string;
  tokenVersion: number;
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
 * Also re-checks the User document on every call — a JWT alone can't know
 * if the account was since suspended or its sessions revoked (logout,
 * password reset), so this confirms the account is still active and the
 * token's version still matches what's currently valid for that user.
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

  const connectToDatabase = (await import("@/lib/mongodb")).default;
  const { User } = await import("@/models/User");
  await connectToDatabase();

  const user = await User.findById(payload.userId).select("isActive tokenVersion").lean();
  if (!user || user.isActive === false) return null;
  if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) return null;

  return payload;
}
