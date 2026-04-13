import { rgba } from 'seemly';

const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

const srgbToLinear = (channel) => {
  const value = channel / 255;
  if (value <= 0.04045) return value / 12.92;
  return ((value + 0.055) / 1.055) ** 2.4;
};

const rgbToXyz = (r, g, b) => {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100;
  const z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100;

  return [x, y, z];
};

const xyzPivot = (value) => {
  const v = value / 100;
  if (v > 0.008856) return Math.cbrt(v);
  return (7.787 * v) + (16 / 116);
};

const xyzToLab = (x, y, z) => {
  const fx = xyzPivot((x / REF_X) * 100);
  const fy = xyzPivot((y / REF_Y) * 100);
  const fz = xyzPivot((z / REF_Z) * 100);

  const l = (116 * fy) - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return [l, a, b];
};

const colorToLab = (color) => {
  const [r, g, b] = rgba(String(color || ''));
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
};

export const deltaE = (colorA, colorB) => {
  const [l1, a1, b1] = colorToLab(colorA);
  const [l2, a2, b2] = colorToLab(colorB);
  const dl = l1 - l2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt((dl * dl) + (da * da) + (db * db));
};

export const isColorSimilar = (colorA, colorB, threshold = 6) => {
  return deltaE(colorA, colorB) < Number(threshold || 0);
};
