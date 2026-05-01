import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCdnUrls } from '../src/config/cdn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const docsDir = path.join(rootDir, 'docs');
const bundlePath = path.join(docsDir, 'bds-static-app.iife.js');
const templatePath = path.join(__dirname, 'static-index.template.html');
const outputPath = path.join(docsDir, 'index.html');
const outputCnPath = path.join(docsDir, 'cn', 'index.html');
const localBdmBaseUrl = 'http://localhost:8000/dist/bili-data-manager.min.js';
const isLocalBdmEnabled = String(process.env.BDS_DEV_LOCAL_BDM || '').trim() === '1';
const localBdmUrl = `${localBdmBaseUrl}?t=${Date.now()}`;
const localBdmScriptTag = isLocalBdmEnabled ? `\n  <script src="${localBdmUrl}"></script>` : '';

const [bundleCode, templateHtml] = await Promise.all([
  readFile(bundlePath, 'utf8'),
  readFile(templatePath, 'utf8'),
]);

const renderHtml = (profile) => {
  const urls = createCdnUrls(profile);
  return templateHtml
    .replace(/__CDN_BASE__/g, urls.base)
    .replace(/__CDN_FAVICON_URL__/g, urls.favicon)
    .replace(/__CDN_VUE_URL__/g, urls.vueGlobalProd)
    .replace(/__CDN_NAIVE_UI_URL__/g, urls.naiveUiProd)
    .replace(/__CDN_BDM_URL__/g, urls.biliDataManager)
    .replace(/__LOCAL_BDM_SCRIPT_TAG__/g, localBdmScriptTag)
    .replace('__BDS_STATIC_APP_BUNDLE__', () => bundleCode);
};

await writeFile(outputPath, renderHtml('jsdelivr'), 'utf8');
await mkdir(path.dirname(outputCnPath), { recursive: true });
await writeFile(outputCnPath, renderHtml('jsdmirror'), 'utf8');
await rm(bundlePath, { force: true });

console.log('Generated docs/index.html and docs/cn/index.html.');
