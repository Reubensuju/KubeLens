import * as vscode from 'vscode';
import { KubeLensTreeDataProvider, ContainerTreeItem } from './ui/KubeLensTreeDataProvider';
import { InsightsPanel } from './ui/InsightsPanel';
import { AnalysisEngine } from './analysis/engine';

export function activate(context: vscode.ExtensionContext) {
    console.log('KubeLens is now active!');

    const treeDataProvider = new KubeLensTreeDataProvider();
    vscode.window.registerTreeDataProvider('kubelens.containersView', treeDataProvider);

    let refreshCommand = vscode.commands.registerCommand('kubelens.refreshContainers', () => {
        treeDataProvider.refresh();
    });

    let openViewCommand = vscode.commands.registerCommand('kubelens.openContainerView', () => {
        vscode.commands.executeCommand('kubelens.containersView.focus');
    });

    let explainCommand = vscode.commands.registerCommand('kubelens.explainContainer', async (node: ContainerTreeItem) => {
        if (!node) {
            vscode.window.showInformationMessage('Please select a container from the KubeLens view.');
            return;
        }

        InsightsPanel.createOrShow(context.extensionUri);

        if (InsightsPanel.currentPanel) {
            InsightsPanel.currentPanel.updateContent(
                node.label,
                `Analyzing container ${node.label}...\n\nFetching logs and inspecting metadata...`
            );

            try {
                const explanation = await AnalysisEngine.explainContainer(node.containerId, node.label, node.status, node.status);

                const htmlContent = `<b>Issue:</b> ${explanation.issue}<br><br>
<b>Confidence:</b> ${(explanation.confidence * 100).toFixed(0)}%<br><br>
<b>Evidence:</b><br>
<ul>
  ${explanation.evidence.map((e: string) => `<li>${e}</li>`).join('')}
</ul><br>
<b>Suggested Fix:</b><br> ${explanation.fix}`;

                InsightsPanel.currentPanel.updateContent(node.label, htmlContent);
            } catch (err) {
                InsightsPanel.currentPanel.updateContent(node.label, `Failed to analyze container: ${(err as Error).message}`);
            }
        }
    });

    let logsCommand = vscode.commands.registerCommand('kubelens.viewLogs', (node: ContainerTreeItem) => {
        if (node) {
            const terminal = vscode.window.createTerminal(`Logs: ${node.label}`);
            terminal.show();
            terminal.sendText(`docker logs -f ${node.containerId}`);
        } else {
            vscode.window.showInformationMessage('Please select a container to view logs.');
        }
    });

    let terminalCommand = vscode.commands.registerCommand('kubelens.openTerminal', (node: ContainerTreeItem) => {
        if (node) {
            const terminal = vscode.window.createTerminal(`Shell: ${node.label}`);
            terminal.show();
            terminal.sendText(`docker exec -it ${node.containerId} /bin/sh`);
        } else {
            vscode.window.showInformationMessage('Please select a container to open terminal.');
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
