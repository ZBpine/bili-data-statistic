import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue'],
      resolvers: [NaiveUiResolver()],
      dts: false,
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: false,
    }),
  ],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: 'src/main.static.js',
      name: 'BdsStaticApp',
      formats: ['iife'],
      fileName: () => 'bds-static-app.iife.js',
    },
    rollupOptions: {
      external: ['vue', 'naive-ui', 'html2canvas'],
      output: {
        globals: {
          vue: 'Vue',
          'naive-ui': 'naive',
          html2canvas: 'html2canvas',
        },
      },
    },
  },
});
