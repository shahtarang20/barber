export async function register() {
  // Only the Node server runtime, and not while `next build` is just collecting pages.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertEnv } = await import("@/lib/envCheck");
  assertEnv();
}
