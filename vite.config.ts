import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { clockProxyPlugin } from "./vite-plugin-clock-proxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 6173,
    // Proxy /api to Django backend (port 8085).
    // Proxy /clock and all Expo web assets to Expo (port 8081) so Clock In works from 6173 only.
    proxy: {
      "/api": {
        target: "http://localhost:8085",
        changeOrigin: true,
      },
      "/_expo": {
        target: "http://localhost:8081",
        changeOrigin: false,
        ws: true,
      },
      "/index.bundle": {
        target: "http://localhost:8081",
        changeOrigin: false,
      },
      "/static": {
        target: "http://localhost:8081",
        changeOrigin: false,
      },
      "/clock": {
        target: "http://localhost:8081",
        changeOrigin: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/clock\/?/, "/") || "/",
      },
    },
  },
  plugins: [
    clockProxyPlugin(),
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
