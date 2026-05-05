import { cB, cE, css, useTheme } from '../../cssr';

const style = cB(
  'bds-interactive-graph-panel',
  css`
    height: 100%;
    min-height: 0;
    position: relative;
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
    cE(
      'resize-handle',
      css`
        width: 100%;
        height: 8px;
        cursor: ns-resize;
        background: linear-gradient(
          to bottom,
          transparent 0,
          transparent 2px,
          var(--bds-interactive-graph-hover-color) 2px,
          var(--bds-interactive-graph-hover-color) 6px,
          transparent 6px,
          transparent 100%
        );
        opacity: 0.3;
        transition: opacity 0.2s ease;

        &:hover {
          opacity: 0.9;
        }
      `,
    ),
  ],
);

export default function mountStyle(mountTarget) {
  useTheme('bds-interactive-graph-panel-style', style, mountTarget);
}
