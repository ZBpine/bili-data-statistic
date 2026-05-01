export const toDateString = (value) => {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatProgress = (ms) => {
  const sec = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(sec / 3600);
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

export const parseProgressToSec = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const matched = text.match(/^(\d{1,2})[:：](\d{2})(?:[:：](\d{2}))?$/);
  if (!matched) return null;
  const p1 = Number(matched[1]);
  const p2 = Number(matched[2]);
  const p3 = matched[3] == null ? null : Number(matched[3]);
  if (!Number.isInteger(p1) || !Number.isInteger(p2) || (p3 != null && !Number.isInteger(p3))) return null;
  if (p2 > 59 || (p3 != null && p3 > 59)) return null;
  return p3 == null ? p1 * 60 + p2 : p1 * 3600 + p2 * 60 + p3;
};

export const parseRangeValue = (value) => {
  const match = /^(\d+)-(\d+)$/.exec(String(value || ''));
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
};
