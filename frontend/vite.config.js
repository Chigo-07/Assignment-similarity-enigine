import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Forwards /api/* from the dev server (5173) to FastAPI (8000) and strips the
// /api prefix, because the backend routes are unprefixed (/auth/login, etc.).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
