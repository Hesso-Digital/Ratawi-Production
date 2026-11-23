import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pre-baked terrain/env textures could ship as .ktx2 in a future pass
  // (integration-plan.md section 4.1); harmless to declare now.
  assetsInclude: ['**/*.ktx2'],
  build: {
    rollupOptions: {
      output: {
        // Keep three/R3F/postprocessing in their own chunk(s), separate from
        // the classic/fallback/operator bundle (plan section 4.4). The reveal
        // page itself is also code-split via React.lazy in AudiencePage.tsx.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three') || id.includes('postprocessing')) {
              return 'three-vendor';
            }
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
              return 'react-vendor';
            }
          }
          return undefined;
        },
      },
    },
  },
});
