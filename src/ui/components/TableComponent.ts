export class TableComponent {
    public static getStyle(): string {
        return `
            .table-container {
                overflow-x: auto;
                width: 100%;
            }
            .data-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
                white-space: nowrap;
            }
            .data-table th {
                text-align: left;
                padding: 8px 16px;
                font-weight: normal;
                color: var(--vscode-editor-foreground);
                opacity: 0.8;
                border-bottom: 1px solid var(--vscode-widget-border);
            }
            .data-table td {
                padding: 8px 16px;
                border-bottom: 1px solid transparent;
            }
            .data-table th:first-child,
            .data-table td:first-child {
                padding-right: 16px;
                padding-left: 16px;
                width: 1%;
            }
            .data-table th:nth-child(2),
            .data-table td:nth-child(2) {
                padding-left: 0;
            }
            .data-table tr:hover td {
                background-color: var(--vscode-list-hoverBackground);
            }
            .status-active {
                color: var(--vscode-testing-iconPassed);
            }
            .status-terminating {
                color: var(--vscode-testing-iconFailed);
            }
            .label-badge {
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                display: inline-block;
                margin-right: 4px;
                margin-bottom: 4px;
            }
            .container-square {
                display: inline-block;
                width: 10px;
                height: 10px;
                margin-right: 2px;
                border-radius: 2px;
                background-color: var(--vscode-disabledForeground, #888);
            }
            .container-square.ready {
                background-color: var(--vscode-testing-iconPassed, #23D18B);
            }
            .checkbox {
                width: 14px;
                height: 14px;
                border: 1px solid var(--vscode-checkbox-border);
                border-radius: 3px;
                background: var(--vscode-checkbox-background);
                display: inline-block;
                vertical-align: middle;
            }
        `;
    }

    public static getHtml(columns: string[], rowsHtml: string): string {
        let theadHtml = `<tr>\n<th><div class="checkbox"></div></th>\n`;
        theadHtml += columns.map(c => `<th>${c}</th>`).join('\n');
        theadHtml += `\n<th style="width: 40px;"></th>\n</tr>`;

        return `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        ${theadHtml}
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }
}
