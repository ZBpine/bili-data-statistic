import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const docsDir = path.join(rootDir, 'docs');
const bundlePath = path.join(docsDir, 'bds-static-app.iife.js');
const templatePath = path.join(__dirname, 'static-index.template.html');
const outputPath = path.join(docsDir, 'index.html');

const [bundleCode, templateHtml] = await Promise.all([
  readFile(bundlePath, 'utf8'),
  readFile(templatePath, 'utf8'),
]);

const html = templateHtml.replace('__BDS_STATIC_APP_BUNDLE__', () => bundleCode);
await writeFile(outputPath, html, 'utf8');
await rm(bundlePath, { force: true });

console.log('Generated docs/index.html (single file).');
