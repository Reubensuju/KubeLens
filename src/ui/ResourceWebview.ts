import * as vscode from 'vscode';
import * as k8s from '@kubernetes/client-node';
import { KubernetesClient } from '../kubernetes/kubernetesClient';
import { BaseTreeItem } from './KubeLensTreeDataProvider';
import { ToolbarComponent } from './components/ToolbarComponent';
import { TableComponent } from './components/TableComponent';

export class ResourceWebview {
    public static async getHtml(node: BaseTreeItem, kubeClient: KubernetesClient): Promise<string> {
        let contentHtml = '';
        let itemCount = 0;

        if (node.resourceType === 'namespaces' && node.contextName) {
            const namespaces = await kubeClient.getNamespacesFull(node.contextName);
            itemCount = namespaces.length;
            contentHtml = this.buildNamespacesTable(namespaces);
        } else {
            contentHtml = `<p style="padding: 16px;">Renderer for ${node.resourceType} is not implemented yet.</p>`;
        }

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${node.label}</title>
                <link href="https://unpkg.com/@vscode/codicons/dist/codicon.css" rel="stylesheet" />
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0;
                        margin: 0;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    ${ToolbarComponent.getStyle()}
                    ${TableComponent.getStyle()}
                </style>
            </head>
            <body>
                ${ToolbarComponent.getHtml(`Search ${node.label}...`, itemCount)}
                ${contentHtml}
                <script>
                    ${ToolbarComponent.getScript()}
                </script>
            </body>
            </html>
        `;
    }

    private static buildNamespacesTable(namespaces: k8s.V1Namespace[]): string {
        if (namespaces.length === 0) {
            return `<div style="padding: 16px; opacity: 0.6;">No namespaces found.</div>`;
        }

        const rows = namespaces.map(ns => {
            const name = ns.metadata?.name || 'unknown';
            const status = ns.status?.phase || 'Unknown';
            const statusClass = status === 'Active' ? 'status-active' : 'status-terminating';
            const age = this.calculateAge(ns.metadata?.creationTimestamp);

            // Render labels gracefully as pills
            let labelsHtml = '';
            if (ns.metadata?.labels) {
                const limit = 2; // Keep UI clean
                const keys = Object.keys(ns.metadata.labels);
                labelsHtml = keys.slice(0, limit).map(k => `<span class="label-badge">${k}=${ns.metadata!.labels![k]}</span>`).join('');
                if (keys.length > limit) {
                    labelsHtml += `<span class="label-badge">+${keys.length - limit} more</span>`;
                }
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="width: 20%;">${name}</td>
                    <td style="width: 40%;">${labelsHtml}</td>
                    <td style="width: 10%;">${age}</td>
                    <td style="width: 10%;" class="${statusClass}">${status}</td>
                    <td style="width: 40px; text-align:right;"><i class="codicon codicon-kebab-vertical" style="cursor:pointer; opacity: 0.6"></i></td>
                </tr>
            `;
        }).join('');

        return TableComponent.getHtml(['Name', 'Labels', 'Age', 'Status'], rows);
    }

    private static calculateAge(creationTimestamp?: Date): string {
        if (!creationTimestamp) return 'Unknown';
        const ms = Date.now() - new Date(creationTimestamp).getTime();
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins}m`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    }
}
