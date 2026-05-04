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
                        height: 36px;
                        display: flex;
                        align-items: center;
                        padding: 0 16px;
                        background-color: var(--vscode-editor-background);
                        border-bottom: 1px solid var(--vscode-widget-border);
                        justify-content: flex-end;
                        gap: 8px;
                    }
                    .empty-btn {
                        width: 22px;
                        height: 22px;
                        border-radius: 3px;
                        background-color: var(--vscode-toolbar-hoverBackground);
                        opacity: 0.2;
                    }
                    #editor-container {
                        width: 100%;
                        height: calc(100vh - 36px); /* Subtract toolbar only */
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <div class="empty-btn"></div>
                    <div class="empty-btn"></div>
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
