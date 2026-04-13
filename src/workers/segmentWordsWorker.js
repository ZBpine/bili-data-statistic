const JIEBA_WASM_MODULE_URL = 'https://cdn.jsdelivr.net/npm/jieba-wasm@2.4.0/pkg/web/jieba_rs_wasm.js';

const simpleTokenCache = new Map();
const jiebaTokenCache = new Map();
let currentArchiveId = '';

let segmentWorker = null;
let segmentReqId = 0;
const pendingSegmentTasks = new Map();

const setCache = (cache, key, value) => {
  cache.set(key, value);
};

const normalizeWords = (words) => {
  if (!Array.isArray(words)) return [];
  return words
    .map((word) => String(word || '').trim())
    .filter((word) => word.length > 0);
};

const simpleSegment = (content) => {
  const words = String(content || '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/);
  return normalizeWords(words);
};

const ensureSegmentWorker = () => {
  if (segmentWorker) return segmentWorker;

  const workerScript = `
let jiebaModulePromise = null;

const ensureJieba = async (moduleUrl) => {
  if (!jiebaModulePromise) {
    jiebaModulePromise = (async () => {
      const mod = await import(moduleUrl);
      if (typeof mod.default === 'function') {
        await mod.default();
      }
      return mod;
    })();
  }
  return jiebaModulePromise;
};

const compressRepeats = (text, maxRepeat = 3) => {
  let next = String(text || '');
  for (let len = 1; len <= 8; len += 1) {
    const regex = new RegExp('((.{1,' + len + '}))\\\\1{' + maxRepeat + ',}', 'g');
    next = next.replace(regex, (_, __, word) => word.repeat(maxRepeat));
  }
  return next;
};

const normalizeWords = (words) => {
  if (!Array.isArray(words)) return [];
  return words
    .map((word) => String(word || '').trim())
    .filter((word) => word.length > 0);
};

self.onmessage = async (event) => {
  const { id, contents, jiebaUrl } = event.data || {};
  try {
    const source = Array.isArray(contents) ? contents : [];
    const jieba = await ensureJieba(jiebaUrl);
    const list = [];
    for (const row of source) {
      const content = String(row || '');
      if (!content) continue;
      const safeContent = compressRepeats(content);
      const words = typeof jieba.cut === 'function' ? jieba.cut(safeContent, true) : [];
      list.push({ content, tokens: normalizeWords(words) });
    }
    self.postMessage({ id, ok: true, list });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
`;

  const blob = new Blob([workerScript], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  segmentWorker = new Worker(workerUrl, { name: 'segment-words-worker' });
  URL.revokeObjectURL(workerUrl);

  segmentWorker.onmessage = (event) => {
    const payload = event.data || {};
    const task = pendingSegmentTasks.get(payload.id);
    if (!task) return;
    pendingSegmentTasks.delete(payload.id);
    clearTimeout(task.timer);
    if (!payload.ok) {
      task.reject(new Error(payload.error || '分词失败'));
      return;
    }
    task.resolve(Array.isArray(payload.list) ? payload.list : []);
  };

  segmentWorker.onerror = () => {
    const tasks = Array.from(pendingSegmentTasks.values());
    pendingSegmentTasks.clear();
    tasks.forEach((task) => {
      clearTimeout(task.timer);
      task.reject(new Error('分词失败'));
    });
    if (segmentWorker) {
      segmentWorker.terminate();
      segmentWorker = null;
    }
  };

  return segmentWorker;
};

const segmentJiebaMissing = (contents, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const worker = ensureSegmentWorker();
    const id = ++segmentReqId;
    const timer = setTimeout(() => {
      pendingSegmentTasks.delete(id);
      reject(new Error('分词超时'));
    }, Math.max(1000, Number(timeout) || 30000));

    pendingSegmentTasks.set(id, { resolve, reject, timer });
    worker.postMessage({
      id,
      contents,
      jiebaUrl: JIEBA_WASM_MODULE_URL,
    });
  });
};

const addItemTokensToFreq = (freq, tokens, minLen) => {
  const uniq = new Set((Array.isArray(tokens) ? tokens : []).filter((token) => token.length >= minLen));
  for (const token of uniq) {
    freq[token] = (freq[token] || 0) + 1;
  }
};

const aggregateByItems = (items, cache, minLen) => {
  const freq = Object.create(null);
  for (const item of Array.isArray(items) ? items : []) {
    const content = String(item?.content || '');
    if (!content) continue;
    let tokens = cache.get(content);
    if (!Array.isArray(tokens)) {
      tokens = simpleSegment(content);
      setCache(cache, content, tokens);
    }
    addItemTokensToFreq(freq, tokens, minLen);
  }
  return freq;
};

export const segmentWords = async ({ mode = 'simple', items = [], minLen = 2, topN = 1000, timeout = 30000, archiveId = '' } = {}) => {
  const sourceMode = mode === 'jieba' ? 'jieba' : 'simple';
  const safeMinLen = Math.max(1, Number(minLen) || 2);
  const safeTopN = Math.max(1, Number(topN) || 1000);
  const nextArchiveId = String(archiveId || '').trim();

  if (nextArchiveId !== currentArchiveId) {
    simpleTokenCache.clear();
    jiebaTokenCache.clear();
    currentArchiveId = nextArchiveId;
  }

  const cache = sourceMode === 'jieba' ? jiebaTokenCache : simpleTokenCache;
  const sourceItems = Array.isArray(items) ? items : [];

  const missing = sourceMode === 'jieba'
    ? Array.from(new Set(sourceItems
      .map((item) => String(item?.content || ''))
      .filter((content) => content && !cache.has(content))))
    : [];

  if (sourceMode === 'simple') {
    const freq = aggregateByItems(sourceItems, cache, safeMinLen);
    return Object.entries(freq)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, safeTopN);
  } else if (missing.length > 0) {
    const result = await segmentJiebaMissing(missing, timeout);
    for (const row of result) {
      const content = String(row?.content || '');
      if (!content) continue;
      const tokens = normalizeWords(row?.tokens || []);
      setCache(cache, content, tokens);
    }
  }

  const freq = Object.create(null);
  for (const item of sourceItems) {
    const content = String(item?.content || '');
    if (!content) continue;
    addItemTokensToFreq(freq, cache.get(content) || [], safeMinLen);
  }
  return Object.entries(freq)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, safeTopN);
};
