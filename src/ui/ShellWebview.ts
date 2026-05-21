import * as vscode from 'vscode';
import { BaseTreeItem } from './KubeLensTreeDataProvider';
import { ToolbarComponent } from './components/ToolbarComponent';

export class ShellWebview {
    public static currentPanel: ShellWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _shellProcess: any = null;
    private _onDataDisposable: vscode.Disposable | null = null;
    private _onExitDisposable: vscode.Disposable | null = null;

    private constructor(panel: vscode.WebviewPanel, private node: BaseTreeItem, private resourceInfo: any) {
        this._panel = panel;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'updateFilter':
                        await this.startShell(message.pod, message.container);
                        return;
                    case 'input':
                        if (this._shellProcess) {
                            this._shellProcess.write(message.data);
                        }
                        return;
                    case 'resize':
                        if (this._shellProcess) {
                            try {
                                this._shellProcess.resize(message.cols, message.rows);
                            } catch (e) {
                                console.error('Failed to resize PTY:', e);
                            }
                        }
                        return;
                    case 'error':
                        vscode.window.showErrorMessage('ShellWebview Error: ' + message.data);
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

        if (ShellWebview.currentPanel) {
            ShellWebview.currentPanel._panel.reveal(column);
            await ShellWebview.currentPanel.updateResource(node, resourceInfo);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'kubelensShellView',
                `Shell: ${resourceInfo.name}`,
                column,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            ShellWebview.currentPanel = new ShellWebview(panel, node, resourceInfo);
            await ShellWebview.currentPanel.initialize();
        }
    }

    private async updateResource(node: BaseTreeItem, resourceInfo: any) {
        this.node = node;
        this.resourceInfo = resourceInfo;
        this._panel.title = `Shell: ${resourceInfo.name}`;
        await this.initialize();
    }

    private async initialize() {
        this._panel.webview.html = this.getHtmlForWebview();

        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);
            const { kind, name, namespace } = this.resourceInfo;
            const nsArg = namespace && namespace !== 'undefined' && namespace !== 'null' ? `-n ${namespace}` : '';

            let pods: string[] = [];
            let containers: string[] = [];

            if (kind === 'deployment' || kind === 'job' || kind === 'node') {
                if (kind === 'node') {
                    pods = [name];
                    containers = [];
                } else {
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
                }
            } else if (kind === 'pod') {
                pods = [name];
                const podCmd = `kubectl get pod ${name} ${nsArg} -o json --context ${this.node.contextName}`;
                const podOut = await execAsync(podCmd);
                const podData = JSON.parse(podOut.stdout);
                containers = podData.spec.containers.map((c: any) => c.name);
            }

            this._panel.webview.postMessage({
                command: 'initFilters',
                pods,
                containers,
                selectedPod: pods.length > 0 ? pods[0] : '',
                selectedContainer: containers.length > 0 ? containers[0] : ''
            });

            if (pods.length > 0) {
                await this.startShell(pods[0], containers.length > 0 ? containers[0] : '');
            } else {
                this._panel.webview.postMessage({ command: 'output', data: 'No pods found for this resource.\r\n' });
            }
        } catch (e: any) {
            this._panel.webview.postMessage({ command: 'output', data: `Error initializing shell: ${e.message}\r\n` });
        }
    }

    private async startShell(podName: string, containerName: string) {
        if (this._onDataDisposable) {
            this._onDataDisposable.dispose();
            this._onDataDisposable = null;
        }
        if (this._onExitDisposable) {
            this._onExitDisposable.dispose();
            this._onExitDisposable = null;
        }
        if (this._shellProcess) {
            this._shellProcess.kill();
            this._shellProcess = null;
        }

        this._panel.webview.postMessage({ command: 'clearShell' });

        const fs = require('fs');
        const path = require('path');
        const platform = process.platform;
        const arch = process.arch;

        // 1. Ensure spawn-helper is executable on macOS
        if (platform === 'darwin') {
            const helperPath = path.join(__dirname, '..', '..', 'node_modules', 'node-pty', 'prebuilds', `darwin-${arch}`, 'spawn-helper');
            if (fs.existsSync(helperPath)) {
                try {
                    fs.chmodSync(helperPath, 0o755);
                } catch (e) {
                    console.error('Failed to set execute permission on spawn-helper:', e);
                }
            }
        }

        // 2. Resolve full path to kubectl
        let kubectlPath = 'kubectl';
        try {
            const { execSync } = require('child_process');
            kubectlPath = execSync('which kubectl').toString().trim();
        } catch (e) {
            // Fallback to common absolute paths if 'which' fails
            const commonPaths = [
                '/opt/homebrew/bin/kubectl',
                '/usr/local/bin/kubectl',
                '/usr/bin/kubectl',
                '/bin/kubectl'
            ];
            for (const p of commonPaths) {
                if (fs.existsSync(p)) {
                    kubectlPath = p;
                    break;
                }
            }
        }

        const pty = require('node-pty');
        const { namespace, kind } = this.resourceInfo;
        const nsArg = namespace && namespace !== 'undefined' && namespace !== 'null' ? ['-n', namespace] : [];
        
        let args: string[];
        if (kind === 'node') {
            args = [
                'debug',
                `node/${podName}`,
                '--context', this.node.contextName!,
                ...nsArg,
                '-it',
                '-q',
                '--image=busybox',
                '--',
                'chroot',
                '/host'
            ];
        } else {
            args = ['exec', '-it', podName, '--context', this.node.contextName!, ...nsArg];
            if (containerName) {
                args.push('-c', containerName);
            }
            args.push('--', 'sh', '-c', 'bash || sh');
        }

        try {
            this._shellProcess = pty.spawn(kubectlPath, args, {
                name: 'xterm-color',
                cols: 120,
                rows: 30,
                cwd: process.env.HOME || '/',
                env: process.env as any
            });

            this._onDataDisposable = this._shellProcess.onData((data: string) => {
                this._panel.webview.postMessage({ command: 'output', data });
            });

            this._onExitDisposable = this._shellProcess.onExit(({ exitCode }: { exitCode: number }) => {
                this._panel.webview.postMessage({ command: 'output', data: `\r\n[Process exited with code ${exitCode}]\r\n` });
            });

        } catch (e: any) {
            this._panel.webview.postMessage({ command: 'output', data: `Failed to start pty: ${e.message}\r\n` });
        }
    }

    public dispose() {
        ShellWebview.currentPanel = undefined;
        if (this._onDataDisposable) {
            this._onDataDisposable.dispose();
        }
        if (this._onExitDisposable) {
            this._onExitDisposable.dispose();
        }
        if (this._shellProcess) {
            this._shellProcess.kill();
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
            <div id="pod-select-container" style="display: none;">
                ${ToolbarComponent.getCustomDropdownHtml('podSelect', 'Select Pod...', [], '250px')}
            </div>
            <div id="container-select-container" style="display: none;">
                ${ToolbarComponent.getCustomDropdownHtml('containerSelect', 'Select Container...', [], '200px')}
            </div>
        `;
        const toolbarHtml = ToolbarComponent.getHtml('Search Terminal', -1, false, [], extraControls);

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://unpkg.com/@vscode/codicons/dist/codicon.css" rel="stylesheet" />
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" crossorigin="anonymous" />
                <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js" crossorigin="anonymous"></script>
                <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js" crossorigin="anonymous"></script>
                <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-search@0.16.0/lib/addon-search.min.js" crossorigin="anonymous"></script>
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
                    #terminal-container {
                        flex-grow: 1;
                        padding: 12px;
                        overflow: hidden;
                        position: relative;
                    }
                    .xterm {
                        height: 100%;
                    }
                </style>
            </head>
            <body>
                ${toolbarHtml}
                <div id="terminal-container"></div>

                <script>
                    const vscode = acquireVsCodeApi();
                    window.onerror = function(msg, url, line, col, error) {
                        vscode.postMessage({ command: 'error', data: msg + ' at ' + line + ':' + col });
                    };
                    
                    const podSelectDetails = document.getElementById('podSelectDetails');
                    const podSelectSummary = document.getElementById('podSelectSummary');
                    const podSelectText = document.getElementById('podSelectSelectedText');
                    const podSelectMenu = podSelectDetails.querySelector('.custom-dropdown-menu');
                    const podSelectContainer = document.getElementById('pod-select-container');

                    const containerSelectDetails = document.getElementById('containerSelectDetails');
                    const containerSelectSummary = document.getElementById('containerSelectSummary');
                    const containerSelectText = document.getElementById('containerSelectSelectedText');
                    const containerSelectMenu = containerSelectDetails.querySelector('.custom-dropdown-menu');
                    const containerSelectContainer = document.getElementById('container-select-container');

                    const searchBar = document.getElementById('searchInput');
                    const btnMatchCase = document.getElementById('btnMatchCase');
                    const btnWholeWord = document.getElementById('btnWholeWord');
                    const btnRegex = document.getElementById('btnRegex');

                    let matchCase = false;
                    let wholeWord = false;
                    let useRegex = false;

                    const computedStyle = getComputedStyle(document.body);
                    let fontFamily = computedStyle.getPropertyValue('--vscode-editor-font-family').trim();
                    if (!fontFamily || fontFamily.startsWith('var')) fontFamily = 'monospace';
                    
                    let bg = computedStyle.getPropertyValue('--vscode-editor-background').trim();
                    let fg = computedStyle.getPropertyValue('--vscode-editor-foreground').trim();
                    if (!bg) bg = '#1e1e1e';
                    if (!fg) fg = '#cccccc';

                    function parseToHex(colorStr, defaultHex) {
                        if (!colorStr) return defaultHex;
                        colorStr = colorStr.trim();
                        if (colorStr.startsWith('#')) {
                            if (colorStr.length > 7) {
                                return colorStr.substring(0, 7);
                            }
                            return colorStr;
                        }
                        if (colorStr.startsWith('rgb')) {
                            const matches = colorStr.match(/\d+/g);
                            if (matches && matches.length >= 3) {
                                const r = parseInt(matches[0]).toString(16).padStart(2, '0');
                                const g = parseInt(matches[1]).toString(16).padStart(2, '0');
                                const b = parseInt(matches[2]).toString(16).padStart(2, '0');
                                return '#' + r + g + b;
                            }
                        }
                        return defaultHex;
                    }

                    const highlightBgColor = parseToHex(computedStyle.getPropertyValue('--vscode-editor-findMatchHighlightBackground'), '#ffff00');
                    const activeBgColor = parseToHex(computedStyle.getPropertyValue('--vscode-editor-findMatchBackground'), '#ffa500');
                    const borderColor = parseToHex(computedStyle.getPropertyValue('--vscode-editor-findMatchHighlightBorder'), '#888888');
                    const activeBorderColor = parseToHex(computedStyle.getPropertyValue('--vscode-editor-findMatchBorder'), '#ff0000');

                    const searchDecorations = {
                        matchBackground: highlightBgColor,
                        matchBorder: borderColor,
                        activeMatchBackground: activeBgColor,
                        activeMatchBorder: activeBorderColor
                    };

                    const terminalContainer = document.getElementById('terminal-container');
                    const term = new Terminal({
                        cursorBlink: true,
                        fontFamily: fontFamily,
                        fontSize: 12,
                        lineHeight: 1.4,
                        theme: { background: bg, foreground: fg },
                        allowProposedApi: true
                    });

                    const fitAddon = new (FitAddon.FitAddon || FitAddon)();
                    const searchAddon = new (SearchAddon.SearchAddon || SearchAddon)();
                    
                    term.loadAddon(fitAddon);
                    term.loadAddon(searchAddon);

                    searchAddon.onDidChangeResults(event => {
                        const countDisplay = document.getElementById('itemCountDisplay');
                        if (countDisplay) {
                            if (event && event.resultCount > 0) {
                                const activeNum = event.resultIndex + 1;
                                countDisplay.innerText = activeNum + '/' + event.resultCount;
                            } else {
                                countDisplay.innerText = searchBar.value ? '0/0' : '';
                            }
                        }
                    });
                    term.open(terminalContainer);
                    fitAddon.fit();
                    vscode.postMessage({
                        command: 'resize',
                        cols: term.cols,
                        rows: term.rows
                    });
                    
                    window.addEventListener('resize', () => {
                        fitAddon.fit();
                        vscode.postMessage({
                            command: 'resize',
                            cols: term.cols,
                            rows: term.rows
                        });
                    });

                    term.onData(data => {
                        vscode.postMessage({ command: 'input', data });
                    });

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'initFilters':
                                populateCustomDropdown(podSelectDetails, message.pods, message.selectedPod);
                                populateCustomDropdown(containerSelectDetails, message.containers, message.selectedContainer);
                                podSelectContainer.style.display = message.pods.length > 1 ? 'block' : 'none';
                                containerSelectContainer.style.display = message.containers.length > 1 ? 'block' : 'none';
                                break;
                            case 'output':
                                term.write(message.data);
                                break;
                            case 'clearShell':
                                term.reset();
                                break;
                        }
                    });

                    function populateCustomDropdown(detailsEl, items, selected) {
                        const summary = detailsEl.querySelector('summary');
                        const textSpan = summary.querySelector('span');
                        const menu = detailsEl.querySelector('.custom-dropdown-menu');
                        
                        menu.innerHTML = '';
                        items.forEach(item => {
                            const option = document.createElement('div');
                            option.className = 'dropdown-option' + (item === selected ? ' active' : '');
                            option.setAttribute('data-value', item);
                            option.textContent = item;
                            
                            option.onclick = (e) => {
                                e.stopPropagation();
                                summary.setAttribute('data-value', item);
                                textSpan.textContent = item;
                                detailsEl.removeAttribute('open');
                                
                                detailsEl.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('active'));
                                option.classList.add('active');
                                
                                onFilterChange();
                            };
                            
                            menu.appendChild(option);
                        });
                        
                        summary.setAttribute('data-value', selected || '');
                        textSpan.textContent = selected || 'Select...';
                    }

                    function onFilterChange() {
                        const pod = podSelectSummary.getAttribute('data-value');
                        const container = containerSelectSummary.getAttribute('data-value');
                        if (pod) {
                            vscode.postMessage({ command: 'updateFilter', pod, container });
                        }
                    }

                    document.addEventListener('click', (event) => {
                        const targetDropdown = event.target.closest('details.custom-dropdown-details');
                        document.querySelectorAll('details.custom-dropdown-details[open]').forEach(details => {
                            if (details !== targetDropdown) {
                                details.removeAttribute('open');
                            }
                        });
                    });

                    function toggleBtn(btn, stateVar) {
                        if (!btn) return stateVar;
                        const newState = !stateVar;
                        if (newState) btn.classList.add('active');
                        else btn.classList.remove('active');
                        return newState;
                    }

                    function doSearch(incremental = true) {
                        if (searchBar.value) {
                            searchAddon.findNext(searchBar.value, {
                                regex: useRegex,
                                wholeWord: wholeWord,
                                caseSensitive: matchCase,
                                incremental: incremental,
                                decorations: searchDecorations
                            });
                        } else {
                            searchAddon.findNext('');
                            const countDisplay = document.getElementById('itemCountDisplay');
                            if (countDisplay) {
                                countDisplay.innerText = '';
                            }
                        }
                    }

                    if (btnMatchCase) btnMatchCase.onclick = () => { matchCase = toggleBtn(btnMatchCase, matchCase); doSearch(true); };
                    if (btnWholeWord) btnWholeWord.onclick = () => { wholeWord = toggleBtn(btnWholeWord, wholeWord); doSearch(true); };
                    if (btnRegex) btnRegex.onclick = () => { useRegex = toggleBtn(btnRegex, useRegex); doSearch(true); };

                    searchBar.addEventListener('input', () => {
                        doSearch(true);
                    });

                    searchBar.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            if (searchBar.value) {
                                if (e.shiftKey) {
                                    searchAddon.findPrevious(searchBar.value, {
                                        regex: useRegex,
                                        wholeWord: wholeWord,
                                        caseSensitive: matchCase,
                                        decorations: searchDecorations
                                    });
                                } else {
                                    searchAddon.findNext(searchBar.value, {
                                        regex: useRegex,
                                        wholeWord: wholeWord,
                                        caseSensitive: matchCase,
                                        incremental: false,
                                        decorations: searchDecorations
                                    });
                                }
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
