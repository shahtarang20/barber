import { User } from "@/models/User";

const RESERVED = new Set(["admin", "api", "login", "register", "dashboard", "new", "null", "undefined"]);

/** "Ramesh Nai" -> "ramesh-nai". Names with no Latin letters (e.g. Hindi) give "barber". */
export function slugFromName(name: string): string {
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "barber";
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && !RESERVED.has(slug);
}

/** A clean link nobody else has: ramesh-nai, then ramesh-nai-2, -3 ... and only then a random tail. */
export async function uniqueSlug(base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)];
  for (const c of candidates) {
    if (isValidSlug(c) && !(await User.exists({ slug: c }))) return c;
  }
  for (let i = 0; i < 10; i++) {
    const c = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await User.exists({ slug: c }))) return c;
  }
  throw new Error("Could not find a free booking link");
}
