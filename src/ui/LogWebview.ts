import * as vscode from 'vscode';
import { BaseTreeItem } from './KubeLensTreeDataProvider';
import { ToolbarComponent } from './components/ToolbarComponent';

export class LogWebview {
    public static currentPanel: LogWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _logProcess: any = null;

    private constructor(panel: vscode.WebviewPanel, private node: BaseTreeItem, private resourceInfo: any) {
        this._panel = panel;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'updateFilter':
                        await this.startLogStream(message.pod, message.container);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static async createOrShow(node: BaseTreeItem, resourceInfo: any) {
        const column = vscode.ViewColumn.Two;

        await vscode.commands.executeCommand('vscode.setEditorLayout', {
            orientation: 1,
            groups: [{ size: 0.5 }, { size: 0.5 }]
        });

        if (LogWebview.currentPanel) {
            LogWebview.currentPanel._panel.reveal(column);
            LogWebview.currentPanel.updateResource(node, resourceInfo);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'kubelensLogView',
                `Logs: ${resourceInfo.name}`,
                column,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            LogWebview.currentPanel = new LogWebview(panel, node, resourceInfo);
        }

        await LogWebview.currentPanel.initialize();
    }

    private async updateResource(node: BaseTreeItem, resourceInfo: any) {
        this.node = node;
        this.resourceInfo = resourceInfo;
        this._panel.title = `Logs: ${resourceInfo.name}`;
        await this.initialize();
    }

    private async initialize() {
        // Build HTML skeleton first
        this._panel.webview.html = this.getHtmlForWebview();

        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);
            const { kind, name, namespace } = this.resourceInfo;
            const nsArg = namespace && namespace !== 'undefined' && namespace !== 'null' ? `-n ${namespace}` : '';

            let pods: string[] = [];
            let containers: string[] = [];

            if (kind === 'deployment' || kind === 'job') {
                // Fetch pods for this workload
                // Hack: Using a label selector or just fetching all pods and filtering by owner could be complex.
                // For simplicity, we can fetch all pods in the namespace and check if they have the name as a prefix.
                // A more robust way is to get the selector from the deployment.
                const cmd = `kubectl get pods ${nsArg} -o json --context ${this.node.contextName}`;
                const { stdout } = await execAsync(cmd);
                const allPods = JSON.parse(stdout).items;
                pods = allPods.filter((p: any) => p.metadata.name.startsWith(name)).map((p: any) => p.metadata.name);
                
                if (pods.length > 0) {
                    const podCmd = `kubectl get pod ${pods[0]} ${nsArg} -o json --context ${this.node.contextName}`;
                    const podOut = await execAsync(podCmd);
                    const podData = JSON.parse(podOut.stdout);
                    containers = podData.spec.containers.map((c: any) => c.name);
                }
            } else if (kind === 'pod') {
                pods = [name];
                const podCmd = `kubectl get pod ${name} ${nsArg} -o json --context ${this.node.contextName}`;
                const podOut = await execAsync(podCmd);
                const podData = JSON.parse(podOut.stdout);
                containers = podData.spec.containers.map((c: any) => c.name);
            }

            // Send metadata to Webview to populate dropdowns
            this._panel.webview.postMessage({
                command: 'initFilters',
                pods,
                containers,
                selectedPod: pods.length > 0 ? pods[0] : '',
                selectedContainer: containers.length > 0 ? containers[0] : ''
            });

            if (pods.length > 0) {
                await this.startLogStream(pods[0], containers.length > 0 ? containers[0] : '');
            } else {
                this._panel.webview.postMessage({ command: 'log', data: 'No pods found for this resource.\r\n' });
            }
        } catch (e: any) {
            this._panel.webview.postMessage({ command: 'log', data: `Error initializing logs: ${e.message}\r\n` });
        }
    }

    private async startLogStream(podName: string, containerName: string) {
        if (this._logProcess) {
            this._logProcess.kill();
            this._logProcess = null;
        }

        this._panel.webview.postMessage({ command: 'clearLogs' });

        const { spawn } = require('child_process');
        const { namespace } = this.resourceInfo;
        const nsArg = namespace && namespace !== 'undefined' && namespace !== 'null' ? ['-n', namespace] : [];
        
        const args = ['logs', '-f', `pod/${podName}`, '--context', this.node.contextName!, ...nsArg];
        if (containerName) {
            args.push('-c', containerName);
        }

        this._logProcess = spawn('kubectl', args);

        this._logProcess.stdout.on('data', (data: Buffer) => {
            this._panel.webview.postMessage({ command: 'log', data: data.toString() });
        });

        this._logProcess.stderr.on('data', (data: Buffer) => {
            this._panel.webview.postMessage({ command: 'log', data: data.toString() });
        });

        this._logProcess.on('close', (code: number) => {
            this._panel.webview.postMessage({ command: 'log', data: `\r\n[Process exited with code ${code}]\r\n` });
        });
    }

    public dispose() {
        LogWebview.currentPanel = undefined;
        if (this._logProcess) {
            this._logProcess.kill();
        }
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private getHtmlForWebview() {
        const extraControls = `
            <select id="pod-select" style="display: none;"></select>
            <select id="container-select" style="display: none;"></select>
        `;
        const toolbarHtml = ToolbarComponent.getHtml('Search logs (Enter for next)...', -1, false, [], extraControls);

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://unpkg.com/@vscode/codicons/dist/codicon.css" rel="stylesheet" />
                <style>
                    ${ToolbarComponent.getStyle()}
                    body {
                        margin: 0;
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        font-family: var(--vscode-editor-font-family, monospace);
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    select {
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        padding: 4px 8px;
                        border-radius: 2px;
                        font-size: 13px;
                        margin-right: 16px;
                        height: 28px;
                    }
                    select:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                        outline-offset: -1px;
                    }
                    #logs-container {
                        flex-grow: 1;
                        overflow-y: auto;
                        padding: 12px;
                        white-space: pre-wrap;
                        word-break: break-all;
                        font-size: 13px;
                        line-height: 1.4;
                    }
                    .highlight {
                        background-color: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 255, 0, 0.3));
                    }
                    .highlight.active {
                        background-color: var(--vscode-editor-findMatchBackground, rgba(255, 165, 0, 0.6));
                    }
                </style>
            </head>
            <body>
                ${toolbarHtml}
                <div id="logs-container"></div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const logsContainer = document.getElementById('logs-container');
                    const podSelect = document.getElementById('pod-select');
                    const containerSelect = document.getElementById('container-select');
                    const searchBar = document.getElementById('searchInput');
                    const countDisplay = document.getElementById('itemCountDisplay');
                    const btnMatchCase = document.getElementById('btnMatchCase');
                    const btnWholeWord = document.getElementById('btnWholeWord');
                    const btnRegex = document.getElementById('btnRegex');
                    
                    let rawLogs = '';
                    let highlights = [];
                    let currentHighlightIndex = -1;
                    
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

                    if (btnMatchCase) btnMatchCase.onclick = () => { matchCase = toggleBtn(btnMatchCase, matchCase); renderLogs(); scrollToActiveHighlight(); };
                    if (btnWholeWord) btnWholeWord.onclick = () => { wholeWord = toggleBtn(btnWholeWord, wholeWord); renderLogs(); scrollToActiveHighlight(); };
                    if (btnRegex) btnRegex.onclick = () => { useRegex = toggleBtn(btnRegex, useRegex); renderLogs(); scrollToActiveHighlight(); };

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'initFilters':
                                populateSelect(podSelect, message.pods, message.selectedPod);
                                populateSelect(containerSelect, message.containers, message.selectedContainer);
                                podSelect.style.display = message.pods.length > 1 ? 'block' : 'none';
                                containerSelect.style.display = message.containers.length > 1 ? 'block' : 'none';
                                break;
                            case 'log':
                                appendLog(message.data);
                                break;
                            case 'clearLogs':
                                logsContainer.innerHTML = '';
                                rawLogs = '';
                                highlights = [];
                                currentHighlightIndex = -1;
                                if (countDisplay) countDisplay.innerText = '';
                                break;
                        }
                    });

                    function populateSelect(selectEl, items, selected) {
                        selectEl.innerHTML = '';
                        items.forEach(item => {
                            const option = document.createElement('option');
                            option.value = item;
                            option.textContent = item;
                            if (item === selected) option.selected = true;
                            selectEl.appendChild(option);
                        });
                    }

                    function onFilterChange() {
                        const pod = podSelect.value;
                        const container = containerSelect.value;
                        if (pod) {
                            vscode.postMessage({ command: 'updateFilter', pod, container });
                        }
                    }

                    podSelect.addEventListener('change', () => {
                        vscode.postMessage({ command: 'updateFilter', pod: podSelect.value, container: '' });
                    });
                    
                    containerSelect.addEventListener('change', onFilterChange);

                    function escapeHtml(unsafe) {
                        return unsafe
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/"/g, "&quot;")
                            .replace(/'/g, "&#039;");
                    }

                    function appendLog(data) {
                        rawLogs += escapeHtml(data);
                        renderLogs();
                    }

                    function escapeStr(s) {
                        return s.split('').map(c => '.*+?^$(){}[]|\\\\\\\\'.includes(c) ? '\\\\\\\\' + c : c).join('');
                    }

                    function renderLogs() {
                        const rawQuery = searchBar.value;
                        if (!rawQuery) {
                            logsContainer.innerHTML = rawLogs;
                            scrollToBottom();
                            if (countDisplay) countDisplay.innerText = '';
                            return;
                        }

                        let matchCount = 0;
                        try {
                            const flags = matchCase ? 'g' : 'gi';
                            let regexStr = rawQuery;
                            if (!useRegex) {
                                regexStr = escapeStr(regexStr);
                            }
                            if (wholeWord) {
                                regexStr = '\\\\b' + regexStr + '\\\\b';
                            }
                            const regex = new RegExp(regexStr, flags);
                            
                            const highlightedHtml = rawLogs.replace(regex, (match) => {
                                const isActive = matchCount === currentHighlightIndex;
                                const cls = isActive ? 'highlight active' : 'highlight';
                                matchCount++;
                                return \`<span class="\${cls}">\${match}</span>\`;
                            });

                            logsContainer.innerHTML = highlightedHtml;
                        } catch (e) {
                            // Invalid regex, just show raw logs
                            logsContainer.innerHTML = rawLogs;
                        }
                        
                        if (countDisplay && matchCount > 0) {
                            const activeNum = matchCount > 0 ? currentHighlightIndex + 1 : 0;
                            countDisplay.innerText = \`\${activeNum} of \${matchCount}\`;
                        } else if (countDisplay) {
                            countDisplay.innerText = 'No results';
                        }

                        scrollToBottom();
                    }

                    function scrollToBottom() {
                        // Only auto-scroll if we aren't focused on a specific highlight
                        if (currentHighlightIndex === -1) {
                            logsContainer.scrollTop = logsContainer.scrollHeight;
                        }
                    }

                    searchBar.addEventListener('input', () => {
                        currentHighlightIndex = searchBar.value ? 0 : -1;
                        renderLogs();
                        scrollToActiveHighlight();
                    });

                    searchBar.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            const highlightsCount = logsContainer.querySelectorAll('.highlight').length;
                            if (highlightsCount > 0) {
                                currentHighlightIndex = (currentHighlightIndex + 1) % highlightsCount;
                                renderLogs();
                                scrollToActiveHighlight();
                            }
                        }
                    });

                    function scrollToActiveHighlight() {
                        const activeEl = logsContainer.querySelector('.highlight.active');
                        if (activeEl) {
                            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                </script>
            </body>
            </html>
        `;
    }
}
