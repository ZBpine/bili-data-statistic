import { cB, cE, css, useTheme } from '../../../cssr';

const style = cB(
  'bds-theme-settings',
  css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  [
  ],
);

export default function mountStyle(mountTarget) {
  useTheme('bds-theme-settings-style', style, mountTarget);
}
