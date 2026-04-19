import * as vscode from 'vscode';
import { KubeLensTreeDataProvider, BaseTreeItem, PodTreeItem } from './ui/KubeLensTreeDataProvider';
import { AnalysisEngine } from './analysis/engine';
import { InsightsPanel } from './ui/InsightsPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('KubeLens is now active!');

    const kubeProvider = new KubeLensTreeDataProvider();
    vscode.window.registerTreeDataProvider('kubelens.clustersView', kubeProvider);

    let refreshCommand = vscode.commands.registerCommand('kubelens.refreshContainers', () => {
        kubeProvider.refresh();
    });

    let openViewCommand = vscode.commands.registerCommand('kubelens.openContainerView', () => {
        vscode.commands.executeCommand('kubelens.clustersView.focus');
    });

    let explainCommand = vscode.commands.registerCommand('kubelens.explainContainer', async (node: BaseTreeItem) => {
        if (!node || node.type !== 'pod' || !(node instanceof PodTreeItem)) {
            vscode.window.showInformationMessage('Please select a Kubernetes Pod from the clusters view.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing Pod ${node.label}...`,
            cancellable: false
        }, async () => {
            try {
                const explanation = await AnalysisEngine.explainPod(node.pod, node.namespace, kubeProvider.kubeClient);

                const htmlContent = `<b>Issue:</b> ${explanation.issue}<br><br>
<b>Confidence:</b> ${(explanation.confidence * 100).toFixed(0)}%<br><br>
<b>Evidence:</b><br>
<ul>
  ${explanation.evidence.map((e: string) => `<li>${e}</li>`).join('')}
</ul><br>
<b>Suggested Fix:</b><br> ${explanation.fix}`;

                InsightsPanel.createOrShow(context.extensionUri);
                if (InsightsPanel.currentPanel) {
                    InsightsPanel.currentPanel.updateContent(node.label, htmlContent);
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`KubeLens Error: ${err.message}`);
            }
        });
    });

    let viewLogsCommand = vscode.commands.registerCommand('kubelens.viewLogs', (node: BaseTreeItem) => {
        if (node instanceof PodTreeItem) {
            const terminal = vscode.window.createTerminal(`Logs: ${node.label}`);
            terminal.show();
            terminal.sendText(`kubectl logs -f ${node.pod.metadata?.name} -n ${node.namespace}`);
        } else {
            vscode.window.showInformationMessage('Please select a Pod to view logs.');
        }
    });

    let openTerminalCommand = vscode.commands.registerCommand('kubelens.openTerminal', (node: BaseTreeItem) => {
        if (node instanceof PodTreeItem) {
            const terminal = vscode.window.createTerminal(`Shell: ${node.label}`);
            terminal.show();
            terminal.sendText(`kubectl exec -it ${node.pod.metadata?.name} -n ${node.namespace} -- /bin/sh`);
        } else {
            vscode.window.showInformationMessage('Please select a Pod to open terminal.');
        }
    });

    context.subscriptions.push(
        refreshCommand,
        openViewCommand,
        explainCommand,
        viewLogsCommand,
        openTerminalCommand
    );
}

export function deactivate() { }
