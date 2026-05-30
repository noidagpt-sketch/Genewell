import { defineConfig } from "vite";
import path from "path";

// Server build configuration
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "server/node-build.ts"),
      name: "server",
      fileName: "production",
      formats: ["es"],
    },
    outDir: "dist/server",
    target: "node22",
    ssr: true,
    rollupOptions: {
      external: [
        // Node.js built-ins
        /^node:/,
        "fs",
        "path",
        "url",
        "http",
        "https",
        "os",
        "crypto",
        "stream",
        "util",
        "events",
        "buffer",
        "querystring",
        "child_process",
        "net",
        "tls",
        "zlib",
        "assert",
        "constants",
        "string_decoder",
        "module",
        "worker_threads",
        // All production npm dependencies - resolved from node_modules at runtime
        "express",
        "cors",
        "pg",
        "pg-pool",
        "pg-protocol",
        "pg-types",
        "nodemailer",
        "pdfkit",
        "jspdf",
        "exceljs",
        "openai",
        "zod",
        "zod-validation-error",
        "@octokit/rest",
        "p-limit",
        "p-retry",
        "drizzle-zod",
      ],
      output: {
        format: "es",
        entryFileNames: "[name].mjs",
      },
    },
    minify: false, // Keep readable for debugging
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
