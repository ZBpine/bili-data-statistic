const ROOT_KEY = 'bds-storage';

const toSegments = (path) => String(path || '').split('.').filter(Boolean);

const loadRoot = () => {
  try {
    const raw = localStorage.getItem(ROOT_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
};

const saveRoot = (root) => {
  try {
    localStorage.setItem(ROOT_KEY, JSON.stringify(root));
  } catch {}
};

export function get(path, fallback = undefined) {
  const segs = toSegments(path);
  if (!segs.length) return fallback;

  let current = loadRoot();
  for (const seg of segs) {
    if (!current || typeof current !== 'object' || !(seg in current)) {
      return fallback;
    }
    current = current[seg];
  }
  return current === undefined ? fallback : current;
}

export function set(path, value) {
  const segs = toSegments(path);
  if (!segs.length) return;

  const root = loadRoot();
  let current = root;

  for (let i = 0; i < segs.length - 1; i += 1) {
    const seg = segs[i];
    const next = current[seg];
    if (!next || typeof next !== 'object') {
      current[seg] = {};
    }
    current = current[seg];
  }

  current[segs[segs.length - 1]] = value;
  saveRoot(root);
}

export default { get, set };
