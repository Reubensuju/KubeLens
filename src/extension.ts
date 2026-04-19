import * as vscode from 'vscode';
import { KubeLensTreeDataProvider, BaseTreeItem } from './ui/KubeLensTreeDataProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('KubeLens is now active!');

    const kubeProvider = new KubeLensTreeDataProvider();
    vscode.window.registerTreeDataProvider('kubelens.clustersView', kubeProvider);

    let refreshCommand = vscode.commands.registerCommand('kubelens.refreshContainers', () => {
        kubeProvider.refresh();
    });

    let openResourceTabCommand = vscode.commands.registerCommand('kubelens.openResourceTab', (node: BaseTreeItem) => {
        if (!node || node.type !== 'resource') return;

        const panel = vscode.window.createWebviewPanel(
            `kubelensResourceView-${node.resourceType}`,
            `${node.label} (${node.contextName})`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${node.label}</title>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); }
                    h1 { color: var(--vscode-editor-foreground); font-weight: normal; margin-bottom: 20px; border-bottom: 1px solid var(--vscode-widget-border); padding-bottom: 10px; }
                    .table-container { width: 100%; border-collapse: collapse; }
                    th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--vscode-editorLineNumber-foreground); }
                </style>
            </head>
            <body>
                <h1>☸️ ${node.label} 
                    <span style="font-size: 14px; opacity: 0.6; float: right; margin-top: 10px;">Cluster: ${node.contextName}</span>
                </h1>
                <p><i>Fetching and rendering ${node.resourceType} will be implemented here.</i></p>
                <table class="table-container">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Age</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="3" style="opacity: 0.5;">Loading data from cluster...</td></tr>
                    </tbody>
                </table>
            </body>
            </html>
        `;
    });

    context.subscriptions.push(refreshCommand, openResourceTabCommand);
}

export function deactivate() { }
