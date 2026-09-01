import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
          build: {
            rollupOptions: {
              external: ["@lancedb/lancedb", "apache-arrow"],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "src/main/preload.ts"),
      },
    }),
  ],
});
