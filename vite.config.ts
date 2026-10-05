import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The gallery serves the built files from a nested directory, so every asset
// URL has to be relative. `base: "./"` plus a fixed entry name keeps the demo
// working when opened from demo/index.html on any host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
