import * as vscode from 'vscode';

export class SpecWebview {
    public static currentPanel: SpecWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, private kind: string, private name: string, private spec: string) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this.getHtmlForWebview();
    }

    public static async createOrShow(kind: string, name: string, spec: string) {
        const column = vscode.ViewColumn.Two;

        if (SpecWebview.currentPanel) {
            SpecWebview.currentPanel.kind = kind;
            SpecWebview.currentPanel.name = name;
            SpecWebview.currentPanel.spec = spec;
            SpecWebview.currentPanel._panel.reveal(column);
            SpecWebview.currentPanel._panel.title = `${kind} - ${name}.yaml`;
            SpecWebview.currentPanel._panel.webview.html = SpecWebview.currentPanel.getHtmlForWebview();
        } else {
            const panel = vscode.window.createWebviewPanel(
                'kubelensSpecView',
                `${kind} - ${name}.yaml`,
                column,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            SpecWebview.currentPanel = new SpecWebview(panel, kind, name, spec);
        }
    }

    public dispose() {
        SpecWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private getHtmlForWebview() {
        const title = `${this.kind} - ${this.name}.yaml`;

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body, html {
                        margin: 0;
                        padding: 0;
                        height: 100vh;
                        overflow: hidden;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .toolbar {
                        display: flex;
                        align-items: center;
                        padding: 8px 16px;
                        background-color: var(--vscode-editor-background);
                        border-bottom: 1px solid var(--vscode-widget-border);
                        justify-content: flex-start;
                        gap: 8px;
                        min-height: 24px;
                    }
                    .toolbar-btn {
                        width: 26px;
                        height: 26px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 4px;
                        cursor: pointer;
                        color: var(--vscode-foreground);
                        opacity: 0.8;
                        transition: color 0.1s ease;
                    }
                    .toolbar-btn:hover {
                        background-color: transparent;
                        color: var(--vscode-focusBorder);
                        opacity: 1;
                    }
                    .toolbar-btn svg {
                        width: 18px;
                        height: 18px;
                    }
                    #editor-container {
                        width: 100%;
                        height: calc(100vh - 39px); /* Adjusted for 6px+6px padding and 26px content height */
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div id="btnSave" class="toolbar-btn" title="Save">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M18.1716 1C18.702 1 19.2107 1.21071 19.5858 1.58579L22.4142 4.41421C22.7893 4.78929 23 5.29799 23 5.82843V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H18.1716ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21L5 21L5 15C5 13.3431 6.34315 12 8 12L16 12C17.6569 12 19 13.3431 19 15V21H20C20.5523 21 21 20.5523 21 20V6.82843C21 6.29799 20.7893 5.78929 20.4142 5.41421L18.5858 3.58579C18.2107 3.21071 17.702 3 17.1716 3H17V5C17 6.65685 15.6569 8 14 8H10C8.34315 8 7 6.65685 7 5V3H4ZM17 21V15C17 14.4477 16.5523 14 16 14L8 14C7.44772 14 7 14.4477 7 15L7 21L17 21ZM9 3H15V5C15 5.55228 14.5523 6 14 6H10C9.44772 6 9 5.55228 9 5V3Z" fill="currentColor"></path></svg>
                    </div>
                    <div id="btnFind" class="toolbar-btn" title="Find">
                        <svg fill="currentColor" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" transform="rotate(270)"><path d="M54,0A42.051,42.051,0,0,0,12,42a41.5989,41.5989,0,0,0,8.48,25.0356L1.7578,85.7578a5.9994,5.9994,0,1,0,8.4844,8.4844L28.9644,75.52A41.5989,41.5989,0,0,0,54,84,42,42,0,0,0,54,0Zm0,72A30,30,0,1,1,84,42,30.0353,30.0353,0,0,1,54,72Z"></path></svg>
                    </div>
                </div>
                <div id="editor-container"></div>

                <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
                <script>
                    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
                    require(['vs/editor/editor.main'], function() {
                        const editor = monaco.editor.create(document.getElementById('editor-container'), {
                            value: \`${this.spec.replace(/`/g, '\\`').replace(/\${/g, '\\${')}\`,
                            language: 'yaml',
                            theme: document.body.classList.contains('vscode-dark') ? 'vs-dark' : 'vs',
                            readOnly: true,
                            automaticLayout: true,
                            fontSize: 13,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            lineNumbers: 'on',
                            renderLineHighlight: 'all',
                            fontFamily: 'var(--vscode-editor-font-family)',
                            scrollbar: {
                                useShadows: false,
                                verticalHasArrows: false,
                                horizontalHasArrows: false,
                                vertical: 'visible',
                                horizontal: 'visible'
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }
}
