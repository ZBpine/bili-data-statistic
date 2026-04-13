import { c, cB, cE, css, useTheme } from "../cssr";

const style = c([
    cB(
        "bds-dm-panel",
        css`
            height: 100%;
            min-height: 0;
            min-width: 0;
        `,
        [
            cE(
                "main",
                css`
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    gap: 12px;
                    align-items: stretch;
                    height: 100%;
                    min-height: 0;
                    min-width: 0;
                    overflow: hidden;
                `,
            ),
            cE(
                "left",
                css`
                    min-width: 0;
                    min-height: 0;
                    overflow: auto;
                    padding: 2px;
                `,
            ),
            cE(
                "right",
                css`
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    min-width: 0;
                    min-height: 0;
                    overflow: hidden;
                `,
            ),
            cE(
                "right-header",
                css`
                    padding: 8px;
                    border-bottom: 1px solid var(--dm-border-color);
                    box-shadow: rgba(0, 0, 0, 0.05) 2px 2px 2px;
                `,
            ),
            cE(
                "result-block",
                css`
                    padding: 0 8px;
                    border-left: 2px solid var(--dm-border-color);
                `,
            ),
            cE(
                "table-block",
                css`
                    display: flex;
                    flex-direction: column;
                    height: calc(100% - 4px);
                    min-height: 360px;
                    flex-shrink: 0;
                `,
            ),
            cE(
                "table",
                css`
                    flex: 1;
                    min-height: 0;
                `,
            ),
            c("@media (max-width: 1100px)", [
                cE(
                    "main",
                    css`
                        grid-template-columns: 1fr;
                    `,
                ),
            ]),
        ],
    ),
]);

export default function mountStyle(mountTarget) {
    useTheme("bds-dm-panel-style", style, mountTarget);
}
