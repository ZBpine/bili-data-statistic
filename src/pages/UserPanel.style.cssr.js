import { c, cB, css, useTheme } from '../cssr';

const style = c([
  cB(
    'bds-user-panel',
    css`
    `,
  ),
]);

export default function mountStyle(mountTarget) {
  useTheme('bds-user-panel-style', style, mountTarget);
}
