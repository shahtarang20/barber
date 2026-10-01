"use client";

import { useEffect } from "react";

/**
 * If the server says the session is no longer valid (barber suspended, password reset, logged out
 * elsewhere), send him to the login page instead of leaving an empty dashboard on screen.
 * Watches the dashboard's own data calls, so it costs no extra requests.
 */
export function SessionGuard() {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
        const isOwnApi = url.startsWith("/api/barber") || url.startsWith(`${window.location.origin}/api/barber`);
        if (res.status === 401 && isOwnApi && window.location.pathname.startsWith("/dashboard")) {
          window.location.href = "/login";
        }
      } catch {}
      return res;
    };
    return () => { window.fetch = original; };
  }, []);
  return null;
}
