import * as vscode from 'vscode';
import { BaseTreeItem } from './KubeLensTreeDataProvider';
import { ToolbarComponent } from './components/ToolbarComponent';

export class ShellWebview {
    public static currentPanel: ShellWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _shellProcess: any = null;

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
                        if (this._shellProcess && this._shellProcess.stdin) {
                            this._shellProcess.stdin.write(message.data);
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
            ShellWebview.currentPanel.updateResource(node, resourceInfo);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'kubelensShellView',
                `Shell: ${resourceInfo.name}`,
                column,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            ShellWebview.currentPanel = new ShellWebview(panel, node, resourceInfo);
        }

        await ShellWebview.currentPanel.initialize();
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
                    // For a node, we might want to start a privileged pod or just list pods on the node.
                    // But shell into a node isn't directly supported via kubectl exec. Let's just pass node name 
                    // and handle it if possible, but standard kubectl doesn't have `kubectl shell node`.
                    // A workaround is `kubectl debug node/...`. We'll just alert for now.
                    this._panel.webview.postMessage({ command: 'output', data: 'Shelling directly into a Node requires privileged pods (like kubectl debug). Only Pods are fully supported for now.\r\n' });
                    return;
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
        if (this._shellProcess) {
            this._shellProcess.kill();
            this._shellProcess = null;
        }

        this._panel.webview.postMessage({ command: 'clearShell' });

        const { spawn } = require('child_process');
        const { namespace } = this.resourceInfo;
        const nsArg = namespace && namespace !== 'undefined' && namespace !== 'null' ? ['-n', namespace] : [];
        
        const args = ['exec', '-i', podName, '--context', this.node.contextName!, ...nsArg];
        if (containerName) {
            args.push('-c', containerName);
        }
        
        args.push('--', 'bash');

        try {
            this._shellProcess = spawn('kubectl', args);

            this._shellProcess.stdout.on('data', (data: Buffer) => {
                this._panel.webview.postMessage({ command: 'output', data: data.toString() });
            });

            this._shellProcess.stderr.on('data', (data: Buffer) => {
                this._panel.webview.postMessage({ command: 'output', data: data.toString() });
            });

            this._shellProcess.on('close', (code: number) => {
                this._panel.webview.postMessage({ command: 'output', data: `\r\n[Process exited with code ${code}]\r\n` });
            });

            // Send initial prompt setup
            this._panel.webview.postMessage({ command: 'setPrompt', podName });
            setTimeout(() => {
                this._panel.webview.postMessage({ command: 'output', data: `__KUBELENS_PROMPT__` });
            }, 300);

        } catch (e: any) {
            this._panel.webview.postMessage({ command: 'output', data: `Failed to start shell: ${e.message}\r\n` });
        }
    }

    public dispose() {
        ShellWebview.currentPanel = undefined;
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
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
                <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/xterm-addon-search@0.13.0/lib/xterm-addon-search.min.js"></script>
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

                    const terminalContainer = document.getElementById('terminal-container');
                    const term = new Terminal({
                        cursorBlink: true,
                        fontFamily: fontFamily,
                        fontSize: 13,
                        theme: { background: bg, foreground: fg }
                    });

                    const fitAddon = new FitAddon.FitAddon();
                    const searchAddon = new SearchAddon.SearchAddon();
                    
                    term.loadAddon(fitAddon);
                    term.loadAddon(searchAddon);
                    term.open(terminalContainer);
                    fitAddon.fit();
                    
                    window.addEventListener('resize', () => {
                        fitAddon.fit();
                    });

                    let inputBuffer = '';
                    let currentPrompt = 'root@pod:/# ';

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'setPrompt':
                                currentPrompt = \`root@\${message.podName}:/# \`;
                                break;
                            case 'initFilters':
                                populateCustomDropdown(podSelectDetails, message.pods, message.selectedPod);
                                populateCustomDropdown(containerSelectDetails, message.containers, message.selectedContainer);
                                podSelectContainer.style.display = message.pods.length > 1 ? 'block' : 'none';
                                containerSelectContainer.style.display = message.containers.length > 1 ? 'block' : 'none';
                                break;
                            case 'output':
                                let output = message.data.replace(/([^\r])\n/g, '$1\r\n');
                                if (output.startsWith('\n')) output = '\r' + output;
                                
                                if (output.includes('__KUBELENS_PROMPT__')) {
                                    output = output.replace(/__KUBELENS_PROMPT__\r?\n?/g, '\r\n' + currentPrompt);
                                }
                                term.write(output);
                                break;
                            case 'clearShell':
                                term.clear();
                                break;
                        }
                    });

                    term.onData(data => {
                        if (data === '\r') {
                            term.write('\r\n');
                            const cmd = inputBuffer.trim();
                            if (cmd) {
                                let injected = cmd;
                                if (cmd.startsWith('ls')) {
                                    injected = cmd.replace(/^ls/, 'ls --color=auto -C');
                                }
                                vscode.postMessage({ command: 'input', data: injected + '; echo "__KUBELENS_PROMPT__"\n' });
                            } else {
                                term.write(currentPrompt);
                            }
                            inputBuffer = '';
                        } else if (data === '\u007F') { // Backspace
                            if (inputBuffer.length > 0) {
                                inputBuffer = inputBuffer.slice(0, -1);
                                term.write('\b \b');
                            }
                        } else if (data === '\x03') { // Ctrl+C
                            term.write('^C\r\n' + currentPrompt);
                            inputBuffer = '';
                        } else {
                            inputBuffer += data;
                            term.write(data);
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

                    if (btnMatchCase) btnMatchCase.onclick = () => { matchCase = toggleBtn(btnMatchCase, matchCase); };
                    if (btnWholeWord) btnWholeWord.onclick = () => { wholeWord = toggleBtn(btnWholeWord, wholeWord); };
                    if (btnRegex) btnRegex.onclick = () => { useRegex = toggleBtn(btnRegex, useRegex); };

                    function doSearch() {
                        if (searchBar.value) {
                            searchAddon.findNext(searchBar.value, {
                                regex: useRegex,
                                wholeWord: wholeWord,
                                caseSensitive: matchCase
                            });
                        }
                    }

                    searchBar.addEventListener('input', () => {
                        doSearch();
                    });

                    searchBar.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            doSearch();
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
