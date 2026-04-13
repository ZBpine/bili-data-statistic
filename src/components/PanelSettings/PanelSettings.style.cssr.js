import { c, cB, css, useTheme } from '../../cssr';

const style = c([
  cB(
    'bds-panel-settings-body',
    css`
      max-height: 50vh;
      overflow: auto;
    `,
  ),
]);

export default function mountStyle(mountTarget) {
  useTheme('bds-panel-settings-style', style, mountTarget);
}
