import { cB, cE, css, useTheme } from '../../cssr';

const style = cB(
  'bds-interactive-graph-panel',
  css`
    height: 100%;
    min-height: 0;
  `,
  [
    cE(
      'span-input',
      css`
        width: 110px;
      `,
    ),
    cE(
      'action-right',
      css`
        margin-left: auto;
      `,
    ),
    cE(
      'graph',
      css`
        width: 100%;
        aspect-ratio: var(--bds-interactive-graph-aspect, 2 / 1);

        &.is-focus-mode,
        &.is-focus-mode * {
          cursor: crosshair !important;
        }
      `,
    ),
  ],
);

export default function mountStyle(mountTarget) {
  useTheme('bds-interactive-graph-panel-style', style, mountTarget);
}
