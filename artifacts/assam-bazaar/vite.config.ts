import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port     = parseInt(process.env.PORT     ?? "3000", 10);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    // Replit plugins — sirf Replit environment mein load hote hain
    ...(process.env.REPL_ID !== undefined && process.env.NODE_ENV !== "production"
      ? await Promise.all([
          import("@replit/vite-plugin-runtime-error-modal").then(m => m.default()),
          import("@replit/vite-plugin-cartographer").then(m =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
          ),
        ])
      : []
    ),
  ],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ["react", "react-dom"],
          router:  ["wouter"],
          query:   ["@tanstack/react-query"],
          ui:      ["lucide-react"],
          // recharts is intentionally NOT a manual chunk: forcing it leaked shared helpers into the entry
          // graph and made every storefront visitor download the 424 KB charts bundle.
          motion:  ["framer-motion"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: isNaN(port) ? 3000 : port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:8080",
        changeOrigin: true,
        rewrite: path => path,
      },
    },
  },
  preview: {
    port: isNaN(port) ? 3000 : port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
