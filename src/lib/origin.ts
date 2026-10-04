/** The address customers actually use (https://yourdomain), also when the app sits behind a proxy such as Vercel's. */
export function publicOrigin(req: Request): string {
  const first = (v: string | null) => v?.split(",")[0].trim() || null;
  const host = first(req.headers.get("x-forwarded-host")) || first(req.headers.get("host"));
  const proto = first(req.headers.get("x-forwarded-proto")) || new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
