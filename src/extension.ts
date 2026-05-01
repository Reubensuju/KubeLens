import * as vscode from 'vscode';
import { KubeLensTreeDataProvider, BaseTreeItem } from './ui/KubeLensTreeDataProvider';
import { ResourceWebview } from './ui/ResourceWebview';

// Map storing active webview panels keyed by Kubernetes Context Name
const clusterPanels: Map<string, vscode.WebviewPanel> = new Map();

class KubeLensContentProvider implements vscode.TextDocumentContentProvider {
    private contentMap = new Map<string, string>();

    public setContent(uri: vscode.Uri, content: string) {
        this.contentMap.set(uri.toString(), content);
    }

    public provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contentMap.get(uri.toString()) || 'No content found.';
    }
}
const kubelensProvider = new KubeLensContentProvider();

export function activate(context: vscode.ExtensionContext) {
    console.log('KubeLens is now active!');

    const kubeProvider = new KubeLensTreeDataProvider();
    vscode.window.registerTreeDataProvider('kubelens.clustersView', kubeProvider);
    
    // Register custom URI scheme for read-only YAML specs
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('kubelens', kubelensProvider));

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

            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'edit') {
                    try {
                        const { exec } = require('child_process');
                        const util = require('util');
                        const execAsync = util.promisify(exec);
                        
                        const nsArg = (message.namespace && message.namespace !== 'undefined' && message.namespace !== 'null') ? `-n ${message.namespace}` : '';
                        const cmd = `kubectl get ${message.kind} ${message.name} ${nsArg} -o yaml --context ${node.contextName}`;
                        
                        const { stdout } = await execAsync(cmd);
                        
                        const kindCapitalized = message.kind.charAt(0).toUpperCase() + message.kind.slice(1);
                        const tabTitle = `${kindCapitalized} - ${message.name}.yaml`;
                        const uri = vscode.Uri.parse(`kubelens:${tabTitle}`);
                        
                        // Set the content in our custom provider
                        kubelensProvider.setContent(uri, stdout);
                        
                        // Open the read-only virtual document
                        const doc = await vscode.workspace.openTextDocument(uri);
                        
                        // Set the language explicitly just in case
                        vscode.languages.setTextDocumentLanguage(doc, 'yaml');
                        
                        // Enforce a downward split layout (two rows)
                        await vscode.commands.executeCommand('vscode.setEditorLayout', {
                            orientation: 1,
                            groups: [{ size: 0.5 }, { size: 0.5 }]
                        });
                        
                        await vscode.window.showTextDocument(doc, {
                            viewColumn: vscode.ViewColumn.Two,
                            preview: true
                        });
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Failed to fetch resource spec: ${e.message}`);
                    }
                }
            });
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
