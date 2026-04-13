import { cB, cE, css, useTheme } from '../../cssr';

const style = cB(
  'bds-panel-shell',
  [
    cE(
      'overlay',
      css`
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
      `,
    ),
    cE(
      'panel',
      css`
        position: fixed;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
        background: var(--bds-panel-shell-bg);
      `,
    ),
    cE(
      'panel-body',
      css`
        padding: 20px;
        box-sizing: border-box;
        height: 100%;
        overflow: hidden;
      `,
    ),
  ],
);

export default function mountStyle(mountTarget) {
  useTheme('bds-panel-shell-style', style, mountTarget);
}
