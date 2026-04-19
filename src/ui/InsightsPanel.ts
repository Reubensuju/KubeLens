import * as vscode from 'vscode';

export class InsightsPanel {
    public static currentPanel: InsightsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview();
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (InsightsPanel.currentPanel) {
            InsightsPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'kubelensInsights',
            'KubeLens Insights',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        InsightsPanel.currentPanel = new InsightsPanel(panel, extensionUri);
    }

    public updateContent(containerName: string, explanation: string) {
        this._panel.webview.html = this._getHtmlForWebview(containerName, explanation);
    }

    private _getHtmlForWebview(title: string = "No Container Selected", content: string = "Select a container to analyze.") {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>KubeLens Insights</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-editor-foreground);
                        padding: 15px;
                    }
                    h1 { color: var(--vscode-editor-foreground); }
                    .content {
                        white-space: pre-wrap;
                        background: var(--vscode-editor-background);
                        padding: 10px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                <h1>KubeLens Insights: \${title}</h1>
                <div class="content">\${content}</div>
            </body>
            </html>`;
    }

    public dispose() {
        InsightsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
