import { c, cB, cE, cM, css, useTheme } from './cssr';

const style = c([
  cB(
    'bds-shell',
    css`
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `,
    [
      cM(
        'static',
        css`
          min-height: 100vh;
        `,
      ),
    ],
  ),
]);

export default function mountStyle(mountTarget) {
  useTheme('bds-app-style', style, mountTarget);
}
