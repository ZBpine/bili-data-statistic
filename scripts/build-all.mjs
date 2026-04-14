import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const run = (command, args, env = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        ...env,
      },
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
};

const distDir = path.join(rootDir, 'dist');
const defaultUserScript = path.join(distDir, 'bili-data-statistic.user.js');
const cnUserScript = path.join(distDir, 'bili-data-statistic.cn.user.js');
const cnTmpUserScript = path.join(rootDir, '.bili-data-statistic.cn.user.js.tmp');

await mkdir(distDir, { recursive: true });

await run('npx', ['vite', 'build'], { BDS_CDN_PROFILE: 'jsdmirror' });
await copyFile(defaultUserScript, cnTmpUserScript);
await run('npx', ['vite', 'build'], { BDS_CDN_PROFILE: 'jsdelivr' });
await copyFile(cnTmpUserScript, cnUserScript);
await rm(cnTmpUserScript, { force: true });
await run('npx', ['vite', 'build', '--config', 'vite.static.config.js']);
await run('node', ['scripts/build-static-html.mjs']);
