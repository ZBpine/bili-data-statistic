import { cB, cE, css, useTheme } from '../../../cssr';

const style = cB(
  'bds-chart-settings',
  css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  [
    cE(
      'block',
      css`
        display: flex;
        flex-direction: column;
        gap: 10px;
      `,
    ),
    cE(
      'custom-row',
      css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      `,
    ),
  ],
);

export default function mountStyle(mountTarget) {
  useTheme('bds-chart-settings-style', style, mountTarget);
}
