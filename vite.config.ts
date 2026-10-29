import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: "/",
  server: {
    port: 3000,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
