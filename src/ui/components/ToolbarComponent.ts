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
            .search-control.active {
                background-color: var(--vscode-toolbar-hoverBackground);
                color: var(--vscode-focusBorder);
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
                        <i id="btnMatchCase" class="search-control codicon codicon-case-sensitive" title="Match Case"></i>
                        <i id="btnWholeWord" class="search-control codicon codicon-whole-word" title="Match Whole Word"></i>
                        <i id="btnRegex" class="search-control codicon codicon-regex" title="Use Regular Expression"></i>
                    </div>
                </div>
                <div class="toolbar-actions">
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
            
            const btnMatchCase = document.getElementById('btnMatchCase');
            const btnWholeWord = document.getElementById('btnWholeWord');
            const btnRegex = document.getElementById('btnRegex');

            let matchCase = false;
            let wholeWord = false;
            let useRegex = false;

            function toggleBtn(btn, stateVar) {
                if (!btn) return stateVar;
                const newState = !stateVar;
                if (newState) btn.classList.add('active');
                else btn.classList.remove('active');
                return newState;
            }

            function triggerSearch() {
                if (searchInput) searchInput.dispatchEvent(new Event('input'));
            }

            if (btnMatchCase) btnMatchCase.onclick = () => { matchCase = toggleBtn(btnMatchCase, matchCase); triggerSearch(); };
            if (btnWholeWord) btnWholeWord.onclick = () => { wholeWord = toggleBtn(btnWholeWord, wholeWord); triggerSearch(); };
            if (btnRegex) btnRegex.onclick = () => { useRegex = toggleBtn(btnRegex, useRegex); triggerSearch(); };

            function escapeStr(s) {
                return s.split('').map(c => '.*+?^$(){}[]|\\\\'.includes(c) ? '\\\\' + c : c).join('');
            }
            
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const rawQuery = e.target.value;
                    let visibleCount = 0;
                    
                    rows.forEach(row => {
                        const rawText = row.innerText;
                        let isMatch = true;
                        
                        if (rawQuery) {
                            try {
                                if (useRegex) {
                                    const flags = matchCase ? 'g' : 'gi';
                                    let regexStr = rawQuery;
                                    if (wholeWord) regexStr = '\\\\b' + regexStr + '\\\\b';
                                    const regex = new RegExp(regexStr, flags);
                                    isMatch = regex.test(rawText);
                                } else {
                                    let targetText = matchCase ? rawText : rawText.toLowerCase();
                                    let searchTxt = matchCase ? rawQuery : rawQuery.toLowerCase();
                                    
                                    if (wholeWord) {
                                        const escaped = escapeStr(searchTxt);
                                        const wordRegex = new RegExp('\\\\b' + escaped + '\\\\b', matchCase ? '' : 'i');
                                        isMatch = wordRegex.test(rawText);
                                    } else {
                                        isMatch = targetText.includes(searchTxt);
                                    }
                                }
                            } catch (err) {
                                isMatch = false; 
                            }
                        }

                        if (isMatch) {
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
