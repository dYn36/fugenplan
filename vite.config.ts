import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2022',
    // Keep fonts in cacheable files; the CSP does not allow embedded font data URLs.
    assetsInlineLimit: 0,
    license: { fileName: 'third-party-licenses.txt' },
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'geometry', test: /node_modules\/(clipper-lib|polygon-clipping|robust-predicates|splaytree)\// },
          ],
        },
      },
    },
  },
});
