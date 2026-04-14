import { cB, cE, css, useTheme } from '../../cssr';

const style = cB(
  'bds-upload-screen',
  css`
    min-height: 100vh;
    background-color: var(--bds-upload-screen-bg-base);
    background-image: 
      radial-gradient(
        ellipse farthest-corner at center,
        var(--bds-upload-screen-bg-base) 70%,
        var(--bds-upload-screen-bg-radial) 100%
      );
    background-repeat: no-repeat;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  `,
  [
    cE(
      'uploader',
      css`
        width: min(720px, 90vw);
      `,
    ),
    cE(
      'bar',
      css`
        width: min(720px, 90vw);
        margin-bottom: 12px;
      `,
    ),
    cE(
      'card',
      css`
        width: 100%;
        min-height: 240px;
        border: 2px dashed var(--bds-upload-border);
        border-radius: 14px;
        background: var(--bds-upload-bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.18s ease;
        &:hover {
          border-color: var(--bds-upload-drag-border);
          box-shadow: var(--bds-upload-drag-shadow);
          transform: scale(1.01);
        }
      `,
    ),
  ],
);

export default function mountStyle(mountTarget) {
  useTheme('bds-upload-screen-style', style, mountTarget);
}
