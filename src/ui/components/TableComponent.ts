export class TableComponent {
    public static getStyle(): string {
        return `
            .table-container {
                width: 100%;
                flex-grow: 1;
                overflow: auto;
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
            .action-btn {
                background: transparent;
                border: 1px solid transparent;
                color: inherit;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                opacity: 0.6;
                transition: all 0.2s;
            }
            .action-btn:hover {
                background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
                opacity: 1;
            }
            .action-menu {
                position: relative;
                display: inline-block;
            }
            .action-menu summary {
                list-style: none;
                outline: none;
            }
            .action-menu summary::-webkit-details-marker {
                display: none;
            }
            .action-dropdown {
                position: absolute;
                right: 0;
                top: 100%;
                z-index: 1000;
                background-color: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                padding: 4px 0;
                min-width: 120px;
                text-align: left;
            }
            .action-dropdown-item {
                padding: 6px 12px;
                cursor: pointer;
                color: var(--vscode-dropdown-foreground);
            }
            .action-dropdown-item:hover {
                background-color: var(--vscode-list-activeSelectionBackground);
                color: var(--vscode-list-activeSelectionForeground);
            }
            /* Clicking outside logic handled via CSS if possible, but details close manually. Here we keep it simple. */
            details[open] summary.action-btn {
                background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
                opacity: 1;
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
