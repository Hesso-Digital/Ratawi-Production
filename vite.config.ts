import react from '@vitejs/plugin-react';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Exposes `virtual:field-models`: the list of GLB files in public/models when
 * the app is built (or served). The 3D scene loads a model only when its file
 * is listed, so new or updated GLBs are picked up by file name with no code
 * change, and a missing file never causes a 404 on the hall screen.
 */
function fieldModels(): Plugin {
  const id = 'virtual:field-models';
  const resolved = '\0' + id;
  const dir = resolve(__dirname, 'public/models');
  return {
    name: 'field-models',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(source) {
      if (source !== resolved) return undefined;
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.glb')).sort() : [];
      return `export default ${JSON.stringify(files)};`;
    },
    configureServer(server) {
      server.watcher.add(dir);
      const reload = (file: string) => {
        if (!file.toLowerCase().endsWith('.glb')) return;
        const mod = server.moduleGraph.getModuleById(resolved);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), fieldModels()],
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
