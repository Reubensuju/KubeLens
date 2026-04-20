import * as vscode from 'vscode';
import { KubeLensTreeDataProvider, BaseTreeItem } from './ui/KubeLensTreeDataProvider';
import { ResourceWebview } from './ui/ResourceWebview';

// Map storing active webview panels keyed by Kubernetes Context Name
const clusterPanels: Map<string, vscode.WebviewPanel> = new Map();

export function activate(context: vscode.ExtensionContext) {
    console.log('KubeLens is now active!');

    const kubeProvider = new KubeLensTreeDataProvider();
    vscode.window.registerTreeDataProvider('kubelens.clustersView', kubeProvider);

    let refreshCommand = vscode.commands.registerCommand('kubelens.refreshContainers', () => {
        kubeProvider.refresh();
    });

    let openResourceTabCommand = vscode.commands.registerCommand('kubelens.openResourceTab', async (node: BaseTreeItem) => {
        if (!node || node.type !== 'resource' || !node.contextName) return;

        let panel = clusterPanels.get(node.contextName);

        if (panel) {
            panel.reveal(vscode.ViewColumn.One);
            panel.title = `${node.label} - ${node.contextName}`;
        } else {
            panel = vscode.window.createWebviewPanel(
                `kubelensClusterView-${node.contextName}`,
                `${node.label} - ${node.contextName}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            panel.onDidDispose(() => {
                clusterPanels.delete(node.contextName!);
            });

            clusterPanels.set(node.contextName, panel);
        }

        // Show a temporary loading state
        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); padding: 20px; }
                </style>
            </head>
            <body>
                <p>Fetching ${node.label} from Cluster <b>${node.contextName}</b>...</p>
            </body>
            </html>
        `;

        // Fetch the specific data block
        try {
            const html = await ResourceWebview.getHtml(node, kubeProvider.kubeClient);
            panel.webview.html = html;
        } catch (e: any) {
            panel.webview.html = `
                <!DOCTYPE html>
                <html>
                <body>
                    <p style="color: var(--vscode-testing-iconFailed);">Failed to fetch data: ${e.message}</p>
                </body>
                </html>
            `;
        }
    });

    context.subscriptions.push(refreshCommand, openResourceTabCommand);
}

export function deactivate() {
    clusterPanels.forEach(panel => panel.dispose());
    clusterPanels.clear();
}
