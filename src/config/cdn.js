export const CDN_BASES = {
  jsdelivr: 'https://cdn.jsdelivr.net/',
  jsdmirror: 'https://cdn.jsdmirror.com/',
};

export const DEFAULT_CDN_PROFILE = 'jsdelivr';
export const DEFAULT_CDN_BASE = CDN_BASES[DEFAULT_CDN_PROFILE];

const normalizeCdnBase = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.endsWith('/') ? text : `${text}/`;
};

export const resolveCdnBase = (profileOrBase) => {
  const text = String(profileOrBase || '').trim();
  if (!text) return DEFAULT_CDN_BASE;
  if (CDN_BASES[text]) return CDN_BASES[text];
  return normalizeCdnBase(text) || DEFAULT_CDN_BASE;
};

const buildNpmUrl = (base, path) => `${base}npm/${path}`;
const buildGhUrl = (base, path) => `${base}gh/${path}`;

export const createCdnUrls = (profileOrBase) => {
  const base = resolveCdnBase(profileOrBase);
  return {
    base,
    vueGlobalProd: buildNpmUrl(base, 'vue@3/dist/vue.global.prod.js'),
    naiveUiProd: buildNpmUrl(base, 'naive-ui@2/dist/index.prod.js'),
    biliDataManager: buildGhUrl(base, 'ZBpine/bili-data-manager@26c45a54a832157dcdc623487102e16f5e043f56/dist/bili-data-manager.min.js'),
    staticHtmlDefault: buildGhUrl(base, 'ZBpine/bili-data-statistic@main/docs/index.html'),
    staticHtmlCn: buildGhUrl(base, 'ZBpine/bili-data-statistic@main/docs/cn/index.html'),
    favicon: buildGhUrl(base, 'ZBpine/bili-data-statistic@main/docs/favicon.ico'),
    echarts: buildNpmUrl(base, 'echarts@6/dist/echarts.min.js'),
    echartsWordcloud: buildNpmUrl(base, 'echarts-wordcloud@2/dist/echarts-wordcloud.min.js'),
    html2canvas: buildNpmUrl(base, 'html2canvas@1.4.1/dist/html2canvas.min.js'),
    jiebaWasm: buildNpmUrl(base, 'jieba-wasm@2.4.0/pkg/web/jieba_rs_wasm.js'),
  };
};

export const resolveRuntimeCdnBase = () => {
  if (typeof globalThis !== 'undefined') {
    const fromWindow = normalizeCdnBase(globalThis.__BDS_CDN_BASE__);
    if (fromWindow) return fromWindow;
  }
  if (typeof __BDS_PROFILE_CDN_BASE__ !== 'undefined') {
    const fromBuild = normalizeCdnBase(__BDS_PROFILE_CDN_BASE__);
    if (fromBuild) return fromBuild;
  }
  return DEFAULT_CDN_BASE;
};

export const runtimeCdnBase = resolveRuntimeCdnBase();
export const runtimeCdnUrls = createCdnUrls(runtimeCdnBase);
