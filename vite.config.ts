import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        sceneEditor: resolve(__dirname, 'scene-editor.html'),
        hotspotViewer: resolve(__dirname, 'hotspot-viewer.html'),
      },
    },
  },
  // You can add other Vite configurations here, e.g., for serving
});