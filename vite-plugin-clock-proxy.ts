/**
 * Runs before Vite's SPA fallback so GET /clock (and Expo assets) are proxied to Expo on 8081.
 * Without this, the main app's index.html is served for /clock and the user sees the web form instead of React Native.
 */
import type { Plugin } from "vite";
import http from "node:http";

const EXPO_PORT = 8081;
const EXPO_ORIGIN = `http://127.0.0.1:${EXPO_PORT}`;

function proxyToExpo(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, pathname: string, search: string): void {
  const path = pathname.replace(/^\/clock\/?/, "/") || "/";
  const url = path + (search || "");
  const headers = { ...req.headers } as Record<string, string>;
  headers.host = `localhost:${EXPO_PORT}`;
  // Request HTML for /clock so we get the app page, not the manifest JSON (Expo may serve manifest at /)
  if (path === "/" || path === "") {
    headers.accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  }
  const opts: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: EXPO_PORT,
    path: url,
    method: req.method,
    headers,
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Clock In proxy error: ${err.message}. Is Expo running? cd mobile && npx expo start --web --port 8081`);
  });
  req.pipe(proxyReq, { end: true });
}

export function clockProxyPlugin(): Plugin {
  return {
    name: "clock-proxy",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        const [pathname, search] = url.includes("?") ? url.split("?", 2) : [url, ""];
        const isClock = pathname === "/clock" || pathname.startsWith("/clock/");
        const isExpoAsset = pathname.startsWith("/_expo") || pathname.startsWith("/index.bundle") || pathname.startsWith("/static");
        if (req.method === "GET" && (isClock || isExpoAsset)) {
          proxyToExpo(req, res, pathname, search ? `?${search}` : "");
          return;
        }
        next();
      });
    },
  };
}
