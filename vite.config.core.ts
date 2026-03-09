/**
 * vite.config.core.ts — Dedicated Vite config for building Nivra Core as a standalone app.
 *
 * Usage:
 *   npx vite build --config vite.config.core.ts
 *
 * Output: dist-core/
 * Deploy to: app.nivra-telecom.ca
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  publicDir: path.resolve(__dirname, "src/core-app/public"),
  build: {
    outDir: "dist-core",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "core.html"),
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
