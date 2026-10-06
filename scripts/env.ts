import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/** The database address for a one-off script. It is read from .env.local (never written into a script, so it cannot leak into git). */
export function requireMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Add it to .env.local (or pass it on the command line) and run again.");
    process.exit(1);
  }
  return uri;
}
