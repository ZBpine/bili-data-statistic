import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import monkey, { util } from 'vite-plugin-monkey';
import { createCdnUrls, resolveCdnBase } from './src/config/cdn.js';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const appVersion = String(packageJson?.version || '0.0.0');
const cdnProfile = String(process.env.BDS_CDN_PROFILE || 'jsdelivr').trim();
const cdnBase = resolveCdnBase(cdnProfile);
const cdnUrls = createCdnUrls(cdnBase);
const isCnProfile = cdnBase.includes('cdn.jsdmirror.com');

const npmCdn = (path) => (version, name) => `${cdnBase}npm/${name}@${version}/${path}`;

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __BDS_PROFILE_CDN_BASE__: JSON.stringify(cdnBase),
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
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'B站弹幕统计',
        version: appVersion,
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
          staticHtml: isCnProfile ? cdnUrls.staticHtmlCn : cdnUrls.staticHtmlDefault,
        },
        require: [
          cdnUrls.biliDataManagerPinned,
        ],
        'run-at': 'document-end',
      },
      build: {
        externalGlobals: {
          vue: ['Vue', npmCdn('dist/vue.global.prod.js')]
            .concat(util.dataUrl(';window.Vue=Vue;globalThis.Vue=Vue;')),
          'naive-ui': ['naive', npmCdn('dist/index.prod.js')],
          // html2canvas: cdn.jsdelivr('html2canvas', 'dist/html2canvas.min.js'),
        },
      },
    }),
  ],
});
