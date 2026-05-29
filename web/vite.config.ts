import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Compiled output lands in ../docs so GitHub Pages keeps serving from
// the same docs/ folder it always has. Base path is /fourth-pay-api/
// because the site lives at nicolaevans82.github.io/fourth-pay-api/.
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/fourth-pay-api/',
  build: {
    outDir: resolve(__dirname, '../docs'),
    // Do NOT emptyOutDir — docs/ also holds the product-brain markdown
    // (01-product-context.md, ENGINEER-HANDOVER.md, postman collection)
    // which is checked in alongside the compiled output. The build
    // overwrites the html/js/css and leaves the markdown intact.
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        employer: resolve(__dirname, 'employer.html'),
      },
    },
  },
});
