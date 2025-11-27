import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: Number(process.env.VITE_PORT) || 8080,
    watch: {
      // Ignore specific files/directories to prevent file watcher limit errors
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.DS_Store/**",
        "**/dist/**",
        "**/build/**",
        "**/.cache/**",
        "**/coverage/**",
      ],
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Force React and related libs into a single 'vendor-react' chunk
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  base: '/',
}));
