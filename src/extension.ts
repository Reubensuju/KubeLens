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
    
    // Register custom URI schemes
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('kubelens', kubelensProvider));
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('kubelens-logs', kubelensProvider));

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
                const { command, kind, name, namespace } = message;
                const nsArg = (namespace && namespace !== 'undefined' && namespace !== 'null') ? `-n ${namespace}` : '';

                if (command === 'edit') {
                    try {
                        const { exec } = require('child_process');
                        const util = require('util');
                        const execAsync = util.promisify(exec);
                        
                        const cmd = `kubectl get ${kind} ${name} ${nsArg} -o yaml --context ${node.contextName}`;
                        const { stdout } = await execAsync(cmd);
                        
                        const kindCapitalized = kind.charAt(0).toUpperCase() + kind.slice(1);
                        const tabTitle = `${kindCapitalized} - ${name}.yaml`;
                        const uri = vscode.Uri.parse(`kubelens:${tabTitle}`);
                        
                        kubelensProvider.setContent(uri, stdout);
                        const doc = await vscode.workspace.openTextDocument(uri);
                        vscode.languages.setTextDocumentLanguage(doc, 'yaml');
                        
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
                } else if (command === 'logs') {
                    const terminalName = `Logs: ${name}`;
                    const logCmd = `kubectl logs -f ${kind}/${name} ${nsArg} --context ${node.contextName}`;
                    
                    // Create a terminal in the Editor area
                    const terminal = vscode.window.createTerminal({
                        name: terminalName,
                        location: vscode.TerminalLocation.Editor,
                        iconPath: new vscode.ThemeIcon('output')
                    });
                    
                    terminal.sendText(logCmd);
                    terminal.show();

                    // Ensure layout is split so terminal appears at bottom if possible
                    // Note: TerminalEditor usually takes a full editor column.
                    await vscode.commands.executeCommand('vscode.setEditorLayout', {
                        orientation: 1,
                        groups: [{ size: 0.5 }, { size: 0.5 }]
                    });
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
