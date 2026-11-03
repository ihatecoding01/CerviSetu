import path from "node:path";
import fs from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isCf = mode === "cloudflare" || process.env.BUILD_TARGET === "cloudflare";
  const outDir = isCf
    ? path.resolve(import.meta.dirname, "./dist")
    : path.resolve(import.meta.dirname, "../backend/dashboard/static");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "mirror-dist-to-cf",
        closeBundle() {
          // Automatically mirror build output to frontend/dist for Cloudflare Pages
          const staticDir = path.resolve(import.meta.dirname, "../backend/dashboard/static");
          const distDir = path.resolve(import.meta.dirname, "./dist");
          if (!isCf && fs.existsSync(staticDir)) {
            fs.cpSync(staticDir, distDir, { recursive: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: process.env.VITE_API_BASE_URL || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
    },
  };
});
