import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run dev`   -> normal dev server with hot reload
// `npm run build` -> ONE self-contained dist/index.html (all JS + CSS inlined)
//                    that runs straight from disk (file://) or any static host.
export default defineConfig(({ mode }) => ({
  base: './',
  // Build-time switch: `--mode live` includes the Supabase version, anything else is the
  // offline prototype (and the Supabase code is left out of that file entirely).
  define: { __LIVE__: JSON.stringify(mode === 'live') },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: { port: 5180 },
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
}));
