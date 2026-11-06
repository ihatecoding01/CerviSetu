import path from "node:path";
import fs from "node:fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(() => {
  const distDir = path.resolve(import.meta.dirname, "./dist");
  const staticDir = path.resolve(import.meta.dirname, "../backend/dashboard/static");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "mirror-dist-to-backend-static",
        closeBundle() {
          // Keep ../backend/dashboard/static in sync for FastAPI local & container serving
          // Clean stale hashed bundles before copying to prevent accumulation of dead assets
          if (fs.existsSync(distDir)) {
            const staticAssetsDir = path.join(staticDir, "assets");
            if (fs.existsSync(staticAssetsDir)) {
              fs.rmSync(staticAssetsDir, { recursive: true, force: true });
            }
            fs.mkdirSync(staticDir, { recursive: true });
            fs.cpSync(distDir, staticDir, { recursive: true });
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
      outDir: distDir,
      emptyOutDir: true,
    },
  };
});
