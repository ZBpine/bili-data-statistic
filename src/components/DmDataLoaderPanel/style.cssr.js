import { c, cB, cE, css, useTheme } from '../../cssr';

const style = c([
  cB(
    'bds-dm-loader-panel',
    css`
      display: flex;
      flex-direction: column;
      gap: 12px;
    `,
    [
      cE(
        'btn',
        css`
          min-width: 150px;
        `,
      ),
      cE(
        'action-row',
        css`
          padding: 2px 0;
        `,
      ),
      cE(
        'hint-btn',
        css`
          width: 20px;
          height: 20px;
          font-size: 12px;
        `,
      ),
      cE(
        'range',
        css`
          width: 280px;
        `,
      ),
      cE(
        'progress-row',
        css`
          margin-top: 12px;
        `,
      ),
      cE(
        'progress',
        css`
          width: 260px;
        `,
      ),
    ],
  ),
]);

export default function mountStyle(mountTarget) {
  useTheme('bds-dm-loader-panel-style', style, mountTarget);
}
