import { changeColor, composite, rgba, toHexString } from 'seemly';

const textColor1 = '#18191C';
const textColor2 = '#484B54';
const textColor3 = '#787D8C';

const fontTheme = {
  fontWeight: '400',
  fontWeightStrong: '700',
  fontSize: '15px',
  fontSizeSmall: '14px',
  fontSizeMedium: '15px',
  fontSizeLarge: '18px',
  fontSizeHuge: '20px',
};

const Statistic = {
  labelFontSize: '13px',
  valueFontSize: '20px',
};

export const DEFAULT_THEME = {
  mode: 'auto',
  lightPrimary: '#00a1d6',
  darkPrimary: '#ff679a',
};

const toOpaqueHex = (color, fallback = DEFAULT_THEME.lightPrimary) => {
  try {
    const [r, g, b] = rgba(String(color || '').trim());
    return toHexString([r, g, b]);
  } catch {
    if (fallback === color) return DEFAULT_THEME.lightPrimary;
    return toOpaqueHex(fallback, DEFAULT_THEME.lightPrimary);
  }
};

const mix = (baseHex, targetHex, ratio) => {
  const base = toOpaqueHex(baseHex);
  const target = toOpaqueHex(targetHex);
  const alpha = Math.max(0, Math.min(1, Number(ratio) || 0));
  const over = changeColor(target, { alpha });
  const mixed = composite(base, over);
  const [r, g, b] = rgba(mixed);
  return toHexString([r, g, b]);
};

const reverseHex = (hex) => {
  const [r, g, b] = rgba(toOpaqueHex(hex));
  return toHexString([255 - r, 255 - g, 255 - b]);
};

const createPrimaryPalette = (baseHex) => {
  const base = toOpaqueHex(baseHex);
  const palette = {
    primaryColor: base,
    primaryColorHover: mix(base, '#ffffff', 0.14),
    primaryColorPressed: mix(base, '#000000', 0.14),
    primaryColorSuppl: mix(base, '#ffffff', 0.06),
  };
  // window.mixWhite=(ratio)=>mix(base, '#ffffff', ratio);
  // window.mixBlack=(ratio)=>mix(base, '#000000', ratio);
  // console.log(palette);
  return palette;
};

export const normalizeThemeMode = (mode) => {
  const value = String(mode || '').trim();
  if (value === 'light' || value === 'dark' || value === 'auto') return value;
  return DEFAULT_THEME.mode;
};

export const normalizeThemeColor = toOpaqueHex;

export const createLightThemeOverrides = (primaryHex = DEFAULT_THEME.lightPrimary) => ({
  common: {
    ...createPrimaryPalette(primaryHex),
    textColor1,
    textColor2,
    textColor3,
    ...fontTheme,
  },
  Statistic,
});

export const createDarkThemeOverrides = (primaryHex = DEFAULT_THEME.darkPrimary) => ({
  common: {
    ...createPrimaryPalette(primaryHex),
    textColor1: reverseHex(textColor1),
    textColor2: reverseHex(textColor2),
    textColor3: reverseHex(textColor3),
    ...fontTheme,
  },
  Statistic,
});
