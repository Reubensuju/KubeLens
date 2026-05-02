export class ToolbarComponent {
    public static getStyle(): string {
        return `
            .toolbar {
                display: flex;
                align-items: center;
                padding: 8px 16px;
                background-color: var(--vscode-editor-background);
                position: sticky;
                top: 0;
                left: 0;
                z-index: 1000;
                width: 100%;
                box-sizing: border-box;
                border-bottom: 1px solid var(--vscode-widget-border);
            }
            .search-container {
                display: flex;
                align-items: center;
                background-color: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                padding: 0 4px 0 0;
                width: 300px;
                margin-right: 16px;
                box-sizing: border-box;
                flex-shrink: 0;
            }
            .search-container:focus-within {
                outline: 1px solid var(--vscode-focusBorder);
                outline-offset: -1px;
            }
            .search-container input {
                background: none;
                border: none;
                color: var(--vscode-input-foreground);
                outline: none;
                flex-grow: 1;
                padding: 4px 8px;
                font-family: var(--vscode-font-family);
                font-size: 13px;
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
            .custom-dropdown-details {
                position: relative;
                font-family: var(--vscode-font-family);
                font-size: 13px;
                margin-right: 16px;
                flex-shrink: 0;
            }
            .custom-dropdown-summary {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                padding: 4px 8px;
                font-size: 13px;
                width: 250px;
                cursor: pointer;
                box-sizing: border-box;
                list-style: none; /* remove default triangle */
                user-select: none;
            }
            .custom-dropdown-summary::-webkit-details-marker {
                display: none;
            }
            .custom-dropdown-summary:focus {
                outline: 1px solid var(--vscode-focusBorder);
                outline-offset: -1px;
            }
            .custom-dropdown-menu {
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
            .dropdown-option {
                padding: 6px 8px;
                cursor: pointer;
                color: var(--vscode-dropdown-foreground);
            }
            .dropdown-option:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            .dropdown-option.active {
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
                letter-spacing: -0.2px;
            }
            .toolbar-actions .codicon {
                cursor: pointer;
                font-size: 14px;
            }
            .toolbar-actions .codicon:hover {
                opacity: 1;
            }
        `;
    }

    public static getCustomDropdownHtml(id: string, defaultText: string, options: { value: string, label: string }[], width: string = '250px'): string {
        const optionsHtml = options.map(opt => `<div class="dropdown-option" data-value="${opt.value}">${opt.label}</div>`).join('');
        return `
            <details class="custom-dropdown-details" id="${id}Details">
                <summary class="custom-dropdown-summary" id="${id}Summary" data-value="${options.length > 0 ? options[0].value : ''}" style="width: ${width};">
                    <span id="${id}SelectedText" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(${width} - 30px);">${defaultText}</span>
                    <i class="codicon codicon-chevron-down"></i>
                </summary>
                <div class="custom-dropdown-menu">
                    ${optionsHtml}
                </div>
            </details>
        `;
    }

    public static getHtml(placeholderText: string, itemCount: number, showNamespaceFilter: boolean = false, allNamespaces: string[] = [], extraControlsHtml: string = ''): string {
        let nsFilterHtml = '';
        if (showNamespaceFilter) {
            const options = [
                { value: 'all', label: 'All Namespaces' },
                ...allNamespaces.map(ns => ({ value: ns, label: ns }))
            ];
            nsFilterHtml = this.getCustomDropdownHtml('namespaceDropdown', 'All Namespaces', options);
        }

        const countHtml = itemCount >= 0 
            ? `<span id="itemCountDisplay">${itemCount === 1 ? '1 item' : itemCount + ' items'}</span>`
            : `<span id="itemCountDisplay"></span>`;

        return `
            <div class="toolbar">
                ${nsFilterHtml}
                ${extraControlsHtml}
                <div class="search-container">
                    <input type="text" id="searchInput" placeholder="${placeholderText}" />
                    <div class="search-controls">
                        <i id="btnMatchCase" class="search-control codicon codicon-case-sensitive" title="Match Case"></i>
                        <i id="btnWholeWord" class="search-control codicon codicon-whole-word" title="Match Whole Word"></i>
                        <i id="btnRegex" class="search-control codicon codicon-regex" title="Use Regular Expression"></i>
                    </div>
                </div>
                <div class="toolbar-actions">
                    ${countHtml}
                </div>
            </div>
        `;
    }

    public static getScript(): string {
        return `
            window.vscode = acquireVsCodeApi();
            
            const searchInput = document.getElementById('searchInput');
            const namespaceDropdownSummary = document.getElementById('namespaceDropdownSummary');
            const selectedNamespaceText = document.getElementById('namespaceDropdownSelectedText');
            const namespaceDropdownDetails = document.getElementById('namespaceDropdownDetails');
            const dropdownOptions = document.querySelectorAll('.dropdown-option');
            
            // Restore state
            const previousState = window.vscode.getState() || {};
            if (previousState.selectedNamespace && namespaceDropdownSummary) {
                const { val, text } = previousState.selectedNamespace;
                // Only restore if the previously selected namespace actually exists on this page
                // (or if it's 'all')
                let exists = val === 'all';
                if (!exists) {
                    dropdownOptions.forEach(opt => {
                        if (opt.getAttribute('data-value') === val) exists = true;
                    });
                }
                
                if (exists) {
                    namespaceDropdownSummary.setAttribute('data-value', val);
                    selectedNamespaceText.innerText = text;
                    dropdownOptions.forEach(opt => {
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
                    
                    if (nsFilterVal && nsFilterVal !== 'all') {
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
            dropdownOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    const details = option.closest('details');
                    const summary = details.querySelector('summary');
                    const selectedText = summary.querySelector('span');
                    const options = details.querySelectorAll('.dropdown-option');
                    
                    // Remove active from sibling options
                    options.forEach(opt => opt.classList.remove('active'));
                    // Add active to clicked
                    option.classList.add('active');
                    
                    // Update summary
                    const val = option.getAttribute('data-value');
                    const text = option.innerText;
                    summary.setAttribute('data-value', val);
                    selectedText.innerText = text;
                    
                    // Save state (if it's the namespace dropdown)
                    if (summary.id === 'namespaceDropdownSummary') {
                        window.vscode.setState({ 
                            ...(window.vscode.getState() || {}),
                            selectedNamespace: { val, text } 
                        });
                        // Trigger filter
                        applyFilters();
                    }
                    
                    // Close details
                    details.removeAttribute('open');
                });
            });
            
            // Initial filter application on load (to enforce restored state)
            applyFilters();

            // Close details dropdowns when clicking outside or clicking another dropdown
            document.addEventListener('click', (event) => {
                const targetDropdown = event.target.closest('details.action-menu, details.custom-dropdown-details');
                document.querySelectorAll('details.action-menu[open], details.custom-dropdown-details[open]').forEach(details => {
                    if (details !== targetDropdown) {
                        details.removeAttribute('open');
                    }
                });
            });
        `;
    }
}
