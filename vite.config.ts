import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const require = createRequire(import.meta.url);
const pdfParseEntry = require.resolve("pdf-parse");
const pdfWorkerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs", {
  paths: [path.dirname(pdfParseEntry)],
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "src/main/index.ts",
        // LanceDB ships a platform-specific native Node module. Keep it as a
        // runtime dependency instead of asking Rolldown to parse the .node file.
        vite: {
          plugins: [
            {
              name: "emit-pdf-worker",
              async generateBundle() {
                this.emitFile({
                  type: "asset",
                  fileName: "pdf.worker.mjs",
                  source: await readFile(pdfWorkerPath),
                });
              },
            },
          ],
          build: {
            rollupOptions: {
              external: ["@lancedb/lancedb", "apache-arrow"],
            },
          },
        },
      },
      preload: {
        input: path.join(import.meta.dirname, "src/main/preload.ts"),
      },
    }),
  ],
});
