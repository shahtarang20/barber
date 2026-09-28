const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Same room map the API routes write to via src/lib/realtime.ts (both run in
// this one Node process, so the plain `global` object is shared state).
const rooms = (global.wsRooms = global.wsRooms || new Map());

function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function verifyToken(token) {
  try {
    if (!process.env.AUTH_SECRET) return null;
    return jwt.verify(token, process.env.AUTH_SECRET);
  } catch {
    return null;
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const token = getCookie(req.headers.cookie, "auth_token");
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const barberId = payload.userId;
      if (!rooms.has(barberId)) rooms.set(barberId, new Set());
      rooms.get(barberId).add(ws);

      ws.on("close", () => {
        rooms.get(barberId)?.delete(ws);
        if (rooms.get(barberId)?.size === 0) rooms.delete(barberId);
      });
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (WebSocket at /ws) as ${dev ? "development" : "production"}`);
  });
});
