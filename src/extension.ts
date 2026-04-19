import * as vscode from 'vscode';
import { KubeLensTreeDataProvider, BaseTreeItem, ContainerTreeItem, PodTreeItem } from './ui/KubeLensTreeDataProvider';
import { AnalysisEngine } from './analysis/engine';
import { InsightsPanel } from './ui/InsightsPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('KubeLens is now active!');

    const dockerProvider = new KubeLensTreeDataProvider('docker');
    vscode.window.registerTreeDataProvider('kubelens.dockerView', dockerProvider);

    const kubeProvider = new KubeLensTreeDataProvider('kubernetes');
    vscode.window.registerTreeDataProvider('kubelens.kubernetesView', kubeProvider);

    let refreshCommand = vscode.commands.registerCommand('kubelens.refreshContainers', () => {
        dockerProvider.refresh();
        kubeProvider.refresh();
    });

    let openViewCommand = vscode.commands.registerCommand('kubelens.openContainerView', () => {
        vscode.commands.executeCommand('kubelens.dockerView.focus');
    });

    let explainCommand = vscode.commands.registerCommand('kubelens.explainContainer', async (node: BaseTreeItem) => {
        if (!node || (node.type !== 'docker-container' && node.type !== 'pod')) {
            vscode.window.showInformationMessage('Please select a Docker Container or a Kubernetes Pod from the KubeLens view.');
            return;
        }

        InsightsPanel.createOrShow(context.extensionUri);

        if (InsightsPanel.currentPanel) {
            InsightsPanel.currentPanel.updateContent(
                node.label,
                `Analyzing resource ${node.label}...\n\nFetching logs and inspecting metadata...`
            );

            try {
                let explanation;
                if (node.type === 'docker-container' && node instanceof ContainerTreeItem) {
                    explanation = await AnalysisEngine.explainContainer(node.containerId, node.label, node.status, node.status);
                } else if (node.type === 'pod' && node instanceof PodTreeItem) {
                    explanation = await AnalysisEngine.explainPod(node.pod, node.namespace, kubeProvider.kubeClient);
                } else {
                    throw new Error("Unsupported resource type");
                }

                const htmlContent = `<b>Issue:</b> ${explanation.issue}<br><br>
<b>Confidence:</b> ${(explanation.confidence * 100).toFixed(0)}%<br><br>
<b>Evidence:</b><br>
<ul>
  ${explanation.evidence.map((e: string) => `<li>${e}</li>`).join('')}
</ul><br>
<b>Suggested Fix:</b><br> ${explanation.fix}`;

                InsightsPanel.currentPanel.updateContent(node.label, htmlContent);
            } catch (err) {
                InsightsPanel.currentPanel.updateContent(node.label, `Failed to analyze resource: ${(err as Error).message}`);
            }
        }
    });

    let logsCommand = vscode.commands.registerCommand('kubelens.viewLogs', (node: BaseTreeItem) => {
        if (node instanceof ContainerTreeItem) {
            const terminal = vscode.window.createTerminal(`Logs: ${node.label}`);
            terminal.show();
            terminal.sendText(`docker logs -f ${node.containerId}`);
        } else if (node instanceof PodTreeItem) {
            const terminal = vscode.window.createTerminal(`Logs: ${node.label}`);
            terminal.show();
            terminal.sendText(`kubectl logs -f ${node.pod.metadata?.name} -n ${node.namespace}`);
        } else {
            vscode.window.showInformationMessage('Please select a Container or Pod to view logs.');
        }
    });

    let terminalCommand = vscode.commands.registerCommand('kubelens.openTerminal', (node: BaseTreeItem) => {
        if (node instanceof ContainerTreeItem) {
            const terminal = vscode.window.createTerminal(`Shell: ${node.label}`);
            terminal.show();
            terminal.sendText(`docker exec -it ${node.containerId} /bin/sh`);
        } else if (node instanceof PodTreeItem) {
            const terminal = vscode.window.createTerminal(`Shell: ${node.label}`);
            terminal.show();
            terminal.sendText(`kubectl exec -it ${node.pod.metadata?.name} -n ${node.namespace} -- /bin/sh`);
        } else {
            vscode.window.showInformationMessage('Please select a Container or Pod to open terminal.');
        }
    });

    context.subscriptions.push(
        openViewCommand,
        explainCommand,
        logsCommand,
        terminalCommand,
        refreshCommand
    );
}

export function deactivate() { }
