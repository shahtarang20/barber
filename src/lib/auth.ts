import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.AUTH_SECRET || "super_secret_fallback_key_for_dev";

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
