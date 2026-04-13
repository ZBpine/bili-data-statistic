import { c, cB, cE, css, useTheme } from '../../cssr';

const style = c([
  cB(
    'bds-share-qrs',
    css`
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    `,
    [
      cE(
        'item',
        css`
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px;
          border: 1px solid var(--n-border-color);
          border-radius: 10px;
          cursor: pointer;
          user-select: none;
          transition: border-color 0.2s, transform 0.15s;

          &:hover,
          &:focus-visible {
            border-color: var(--n-primary-color);
            transform: translateY(-1px);
            outline: none;
          }
        `,
      ),
      cE(
        'title',
        css`
          font-size: 12px;
        `,
      ),
    ],
  ),
]);

export default function mountStyle(mountTarget) {
  useTheme('bds-share-qrs-style', style, mountTarget);
}
