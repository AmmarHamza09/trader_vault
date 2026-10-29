import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const BUILD_ID = Date.now().toString(36);

// Writes dist/version.json so running tabs can detect a new deploy and refresh themselves.
const versionFile = () => ({
  name: 'version-file',
  generateBundle() {
    (this as any).emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
  },
});

export default defineConfig(() => {
  return {
    define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
    plugins: [react(), tailwindcss(), versionFile()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
