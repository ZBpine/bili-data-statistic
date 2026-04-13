import { c, cB, cE, css, useTheme } from '../../cssr';

const style = c([
  cB(
    'bds-dm-chart-manager',
    css`
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      height: 100%;
      max-height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-gutter: stable;
    `,
    [
      cE(
        'body',
        css`
          position: relative;
          flex: 1;
          min-height: 0;
          min-width: 0;
        `,
      ),
      cE(
        'empty',
        css`
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
        `,
      ),
      cE(
        'item',
        css`
          position: relative;
          height: var(--item-height, 50%);
          min-height: 320px;
        `,
      ),
      cE(
        'actions',
        css`
          position: absolute;
          top: 8px;
          right: 10px;
          display: flex;
          direction: rtl;
          align-items: center;
          gap: 3px;
          opacity: 1;
          z-index: 10;
          transition: opacity 0.2s;
        `,
      ),
      cE(
        'action-btn',
        css`
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: none;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(128, 128, 128, 0.45);
          color: #fff;
          font-weight: bold;
          font-size: 12px;
          cursor: pointer;

          &:hover {
            background-color: rgba(90, 90, 90, 0.75);
          }

          &:disabled {
            cursor: not-allowed;
            opacity: 0.35;
          }
        `,
      ),
      cE(
        'chart',
        css`
          width: 100%;
          height: 100%;
        `,
      ),
    ],
  ),
]);

export default function mountStyle(mountTarget) {
  useTheme('bds-dm-chart-manager-style', style, mountTarget);
}
