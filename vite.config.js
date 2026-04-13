import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import monkey, { cdn, util } from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
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
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'B站弹幕统计',
        version: '3.0.0',
        namespace: 'https://github.com/ZBpine/bili-data-statistic',
        description: '获取B站弹幕数据，并生成统计页面。',
        icon: 'https://www.bilibili.com/favicon.ico',
        match: [
          'https://www.bilibili.com/video/*',
          'https://www.bilibili.com/list/watchlater*',
          'https://www.bilibili.com/bangumi/play/*',
          'https://space.bilibili.com/*',
          'https://zbpine.github.io/bili-data-statistic/*',
        ],
        grant: ['GM_xmlhttpRequest', 'GM_getResourceText', 'unsafeWindow'],
        connect: ['api.bilibili.com'],
        resource: {
          staticHtml: 'https://cdn.jsdelivr.net/gh/ZBpine/bili-data-statistic@main/docs/index.html',
        },
        require: [
          'https://cdn.jsdelivr.net/gh/ZBpine/bili-data-manager@ed2aaf5f8fedf7e157a22d10e995df2f61eeb917/dist/bili-data-manager.min.js',
        ],
        'run-at': 'document-end',
      },
      build: {
        externalGlobals: {
          vue: cdn
            .jsdelivr('Vue', 'dist/vue.global.prod.js')
            .concat(util.dataUrl(';window.Vue=Vue;globalThis.Vue=Vue;')),
          'naive-ui': cdn.jsdelivr('naive', 'dist/index.prod.js'),
          // html2canvas: cdn.jsdelivr('html2canvas', 'dist/html2canvas.min.js'),
        },
      },
    }),
  ],
});
