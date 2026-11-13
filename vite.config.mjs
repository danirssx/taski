import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./src/web/preview/", import.meta.url)),
  publicDir: false,
  build: { outDir: fileURLToPath(new URL("./dist/web/", import.meta.url)), emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
