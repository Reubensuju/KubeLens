export class ToolbarComponent {
    public static getStyle(): string {
        return `
            .toolbar {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                background-color: var(--vscode-editor-background);
            }
            .search-container {
                display: flex;
                align-items: center;
                background-color: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                padding: 0 4px;
                width: 300px;
                margin-right: 16px;
                transition: border-color 0.2s;
            }
            .search-container:focus-within {
                border-color: var(--vscode-focusBorder);
            }
            .search-container input {
                background: none;
                border: none;
                color: var(--vscode-input-foreground);
                outline: none;
                flex-grow: 1;
                padding: 5px 4px;
                font-family: var(--vscode-font-family);
            }
            .search-container input::placeholder {
                color: var(--vscode-input-placeholderForeground);
            }
            .search-controls {
                display: flex;
                align-items: center;
                gap: 2px;
            }
            .search-control {
                cursor: pointer;
                border-radius: 3px;
                padding: 2px;
                color: var(--vscode-input-foreground);
                opacity: 0.6;
                font-size: 14px;
            }
            .search-control:hover {
                background-color: var(--vscode-toolbar-hoverBackground);
                opacity: 1;
            }
            .toolbar-actions {
                display: flex;
                align-items: center;
                gap: 12px;
                color: var(--vscode-foreground);
                opacity: 0.8;
                font-size: 12px;
            }
            .toolbar-actions .codicon {
                cursor: pointer;
                font-size: 14px;
            }
            .toolbar-actions .codicon:hover {
                opacity: 1;
            }
            .divider {
                height: 1px;
                background-color: var(--vscode-widget-border);
            }
        `;
    }

    public static getHtml(placeholderText: string, itemCount: number): string {
        return `
            <div class="toolbar">
                <div class="search-container">
                    <input type="text" id="searchInput" placeholder="${placeholderText}" />
                    <div class="search-controls">
                        <i class="search-control codicon codicon-case-sensitive" title="Match Case"></i>
                        <i class="search-control codicon codicon-whole-word" title="Match Whole Word"></i>
                        <i class="search-control codicon codicon-regex" title="Use Regular Expression"></i>
                    </div>
                </div>
                <div class="toolbar-actions">
                    <i class="codicon codicon-cloud-download"></i>
                    <i class="codicon codicon-filter"></i>
                    <span id="itemCountDisplay">${itemCount === 1 ? '1 item' : itemCount + ' items'}</span>
                </div>
            </div>
            <div class="divider"></div>
        `;
    }

    public static getScript(): string {
        return `
            const searchInput = document.getElementById('searchInput');
            const rows = document.querySelectorAll('.data-table tbody tr.searchable-row');
            const countDisplay = document.getElementById('itemCountDisplay');
            
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    let visibleCount = 0;
                    
                    rows.forEach(row => {
                        const text = row.innerText.toLowerCase();
                        if (text.includes(query)) {
                            row.style.display = '';
                            visibleCount++;
                        } else {
                            row.style.display = 'none';
                        }
                    });
                    
                    if (countDisplay) {
                        countDisplay.innerText = visibleCount === 1 ? '1 item' : visibleCount + ' items';
                    }
                });
            }
        `;
    }
}
