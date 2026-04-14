import { runtimeCdnUrls } from '../config/cdn';

const BILI_DATA_MANAGER_CDN = runtimeCdnUrls.biliDataManagerMain;

let hashWorker = null;
let hashReqId = 0;
const pendingHashTasks = new Map();

const ensureHashWorker = () => {
  if (hashWorker) return hashWorker;

  const workerScript = `
let converter = null;
const ensureConverter = (bdmUrl) => {
  if (converter) return converter;
  importScripts(bdmUrl);
  converter = self.BiliDataManager?.BiliUser || null;
  return converter;
};

self.onmessage = (event) => {
  const { id, hash, maxTry, bdmUrl } = event.data || {};
  try {
    const workerConverter = ensureConverter(bdmUrl);
    if (!workerConverter || typeof workerConverter.hashToMid !== 'function') {
      self.postMessage({ id, ok: false, error: '反查能力不可用' });
      return;
    }
    const mid = workerConverter.hashToMid(hash, maxTry);
    self.postMessage({ id, ok: true, mid });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
`;

  const blob = new Blob([workerScript], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  hashWorker = new Worker(workerUrl);
  URL.revokeObjectURL(workerUrl);

  hashWorker.onmessage = (event) => {
    const payload = event.data || {};
    const task = pendingHashTasks.get(payload.id);
    if (!task) return;
    pendingHashTasks.delete(payload.id);
    clearTimeout(task.timer);
    if (!payload.ok) {
      task.reject(new Error(payload.error || '反查失败'));
      return;
    }
    task.resolve(payload.mid);
  };

  hashWorker.onerror = () => {
    const tasks = Array.from(pendingHashTasks.values());
    pendingHashTasks.clear();
    tasks.forEach((task) => {
      clearTimeout(task.timer);
      task.reject(new Error('反查失败'));
    });
    if (hashWorker) {
      hashWorker.terminate();
      hashWorker = null;
    }
  };

  return hashWorker;
};

export const hashToMidByWorker = (hash, maxTry = 100000000) => {
  return new Promise((resolve, reject) => {
    const worker = ensureHashWorker();
    const id = ++hashReqId;
    const timer = setTimeout(() => {
      pendingHashTasks.delete(id);
      reject(new Error('反查超时'));
    }, 30000);

    pendingHashTasks.set(id, { resolve, reject, timer });
    worker.postMessage({ id, hash, maxTry, bdmUrl: BILI_DATA_MANAGER_CDN });
  });
};
