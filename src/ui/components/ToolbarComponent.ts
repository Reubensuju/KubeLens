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
                height: 28px;
                margin-right: 16px;
                transition: border-color 0.2s;
                box-sizing: border-box;
                flex-shrink: 0;
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
                padding: 0;
                height: 100%;
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
            
            /* Custom Dropdown Styles */
            .namespace-dropdown-details {
                position: relative;
                font-family: var(--vscode-font-family);
                font-size: 13px;
                margin-right: 16px;
                flex-shrink: 0;
            }
            .namespace-dropdown-summary {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background-color: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 2px;
                padding: 0 8px;
                width: 250px;
                height: 28px;
                cursor: pointer;
                box-sizing: border-box;
                list-style: none; /* remove default triangle */
                user-select: none;
            }
            .namespace-dropdown-summary::-webkit-details-marker {
                display: none;
            }
            .namespace-dropdown-summary:focus {
                border-color: var(--vscode-focusBorder);
                outline: none;
            }
            .namespace-dropdown-menu {
                position: absolute;
                top: calc(100% + 2px); /* Dropdown appears below */
                left: 0;
                width: 100%;
                background-color: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                border-radius: 2px;
                z-index: 1000;
                max-height: 300px;
                overflow-y: auto;
            }
            .namespace-option {
                padding: 6px 8px;
                cursor: pointer;
                color: var(--vscode-dropdown-foreground);
            }
            .namespace-option:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            .namespace-option.active {
                background-color: var(--vscode-list-activeSelectionBackground);
                color: var(--vscode-list-activeSelectionForeground);
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

    public static getHtml(placeholderText: string, itemCount: number, showNamespaceFilter: boolean = false, allNamespaces: string[] = []): string {
        let nsFilterHtml = '';
        if (showNamespaceFilter) {
            const optionsHtml = allNamespaces.map(ns => `<div class="namespace-option" data-value="${ns}">${ns}</div>`).join('');
            nsFilterHtml = `
                <details class="namespace-dropdown-details" id="namespaceDropdownDetails">
                    <summary class="namespace-dropdown-summary" id="namespaceDropdownSummary" data-value="all">
                        <span id="selectedNamespaceText" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;">All Namespaces</span>
                        <i class="codicon codicon-chevron-down"></i>
                    </summary>
                    <div class="namespace-dropdown-menu">
                        <div class="namespace-option active" data-value="all">All Namespaces</div>
                        ${optionsHtml}
                    </div>
                </details>
            `;
        }

        return `
            <div class="toolbar">
                ${nsFilterHtml}
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
            window.vscode = acquireVsCodeApi();
            
            const searchInput = document.getElementById('searchInput');
            const namespaceDropdownSummary = document.getElementById('namespaceDropdownSummary');
            const selectedNamespaceText = document.getElementById('selectedNamespaceText');
            const namespaceDropdownDetails = document.getElementById('namespaceDropdownDetails');
            const namespaceOptions = document.querySelectorAll('.namespace-option');
            
            // Restore state
            const previousState = window.vscode.getState() || {};
            if (previousState.selectedNamespace && namespaceDropdownSummary) {
                const { val, text } = previousState.selectedNamespace;
                // Only restore if the previously selected namespace actually exists on this page
                // (or if it's 'all')
                let exists = val === 'all';
                if (!exists) {
                    namespaceOptions.forEach(opt => {
                        if (opt.getAttribute('data-value') === val) exists = true;
                    });
                }
                
                if (exists) {
                    namespaceDropdownSummary.setAttribute('data-value', val);
                    selectedNamespaceText.innerText = text;
                    namespaceOptions.forEach(opt => {
                        if (opt.getAttribute('data-value') === val) {
                            opt.classList.add('active');
                        } else {
                            opt.classList.remove('active');
                        }
                    });
                }
            }
            
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
                applyFilters();
            }

            if (btnMatchCase) btnMatchCase.onclick = () => { matchCase = toggleBtn(btnMatchCase, matchCase); triggerSearch(); };
            if (btnWholeWord) btnWholeWord.onclick = () => { wholeWord = toggleBtn(btnWholeWord, wholeWord); triggerSearch(); };
            if (btnRegex) btnRegex.onclick = () => { useRegex = toggleBtn(btnRegex, useRegex); triggerSearch(); };

            function escapeStr(s) {
                return s.split('').map(c => '.*+?^$(){}[]|\\\\'.includes(c) ? '\\\\' + c : c).join('');
            }
            
            function applyFilters() {
                const rawQuery = searchInput ? searchInput.value : '';
                const nsFilterVal = namespaceDropdownSummary ? namespaceDropdownSummary.getAttribute('data-value') : 'all';
                let visibleCount = 0;
                
                rows.forEach(row => {
                    const rawText = row.innerText;
                    let isMatch = true;
                    let matchesNs = true;
                    
                    if (nsFilterVal !== 'all') {
                        const rowNs = row.getAttribute('data-namespace');
                        matchesNs = (rowNs === nsFilterVal);
                    }
                    
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

                    if (isMatch && matchesNs) {
                        row.style.display = '';
                        visibleCount++;
                    } else {
                        row.style.display = 'none';
                    }
                });
                
                if (countDisplay) {
                    countDisplay.innerText = visibleCount === 1 ? '1 item' : visibleCount + ' items';
                }
            }

            if (searchInput) {
                searchInput.addEventListener('input', applyFilters);
            }

            // Handle custom dropdown options click
            namespaceOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Remove active from all
                    namespaceOptions.forEach(opt => opt.classList.remove('active'));
                    // Add active to clicked
                    option.classList.add('active');
                    
                    // Update summary
                    const val = option.getAttribute('data-value');
                    const text = option.innerText;
                    namespaceDropdownSummary.setAttribute('data-value', val);
                    selectedNamespaceText.innerText = text;
                    
                    // Save state
                    window.vscode.setState({ 
                        ...(window.vscode.getState() || {}),
                        selectedNamespace: { val, text } 
                    });
                    
                    // Close details
                    namespaceDropdownDetails.removeAttribute('open');
                    
                    // Trigger filter
                    applyFilters();
                });
            });
            
            // Initial filter application on load (to enforce restored state)
            applyFilters();

            // Close details dropdowns when clicking outside or clicking another dropdown
            document.addEventListener('click', (event) => {
                const targetDropdown = event.target.closest('details.action-menu, details.namespace-dropdown-details');
                document.querySelectorAll('details.action-menu[open], details.namespace-dropdown-details[open]').forEach(details => {
                    if (details !== targetDropdown) {
                        details.removeAttribute('open');
                    }
                });
            });
        `;
    }
}
