import { c, cB, cE, css, useTheme } from '../../cssr';

const style = c([
  cB(
    'bds-entry-launcher',
    css`
      position: fixed;
      left: -100px;
      bottom: 200px;
      width: 120px;
      height: 40px;
      z-index: 700;
      border-top-right-radius: 20px;
      border-bottom-right-radius: 20px;
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      padding: 0 8px 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--n-font-size-medium);
      box-shadow: 0 0 5px var(--dm-launcher-shadow-color);
      transition: left 0.3s ease-in-out, background-color 0.2s ease-in-out;
      overflow: hidden;

      &:hover {
        left: -10px;
      }

      .n-button__content {
        width: 100%;
        justify-content: space-between;
      }
    `,
    [
      cE(
        'text',
        css`
          white-space: nowrap;
          user-select: none;
        `,
      ),
      cE(
        'icon',
        css`
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 2px;

          svg {
            fill: var(--dm-launcher-icon-color);
          }
        `,
      ),
    ],
  ),
]);

export default function mountStyle(mountTarget) {
  useTheme('bds-entry-launcher-style', style, mountTarget);
}
