import * as vscode from 'vscode';
import { KubernetesClient } from '../kubernetes/kubernetesClient';

export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'cluster' | 'category' | 'resource' | 'error',
        public readonly contextName?: string,
        public readonly resourceType?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
        this.tooltip = label;

        if (type === 'cluster') this.iconPath = new vscode.ThemeIcon('server');
        if (type === 'category') this.iconPath = new vscode.ThemeIcon('folder');
        if (type === 'resource') {
            this.iconPath = new vscode.ThemeIcon('list-flat');
            // Attach a command strictly to leaf resources
            this.command = {
                command: 'kubelens.openResourceTab',
                title: 'Open Resource Tab',
                arguments: [this]
            };
        }
        if (type === 'error') this.iconPath = new vscode.ThemeIcon('error');
    }
}

export class KubeLensTreeDataProvider implements vscode.TreeDataProvider<BaseTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BaseTreeItem | undefined | void> = new vscode.EventEmitter<BaseTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BaseTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    public kubeClient: KubernetesClient;

    constructor() {
        this.kubeClient = new KubernetesClient();
    }

    refresh(): void {
        this.kubeClient = new KubernetesClient();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BaseTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: BaseTreeItem): Promise<BaseTreeItem[]> {
        if (!element) {
            // Root level: Clusters
            if (!this.kubeClient.isConfigured()) {
                return [new BaseTreeItem('No valid ~/.kube/config found', vscode.TreeItemCollapsibleState.None, 'error')];
            }
            const contexts = this.kubeClient.getContexts();
            const current = this.kubeClient.getCurrentContext();
            if (contexts.length === 0) {
                return [new BaseTreeItem('No contexts defined in kubeconfig', vscode.TreeItemCollapsibleState.None, 'error')];
            }
            return contexts.map(c => {
                const label = c === current ? `${c} (Current)` : c;
                return new BaseTreeItem(label, vscode.TreeItemCollapsibleState.Collapsed, 'cluster', c);
            });
        }

        if (element.type === 'cluster') {
            return [
                new BaseTreeItem('Nodes', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'nodes'),
                new BaseTreeItem('Workloads', vscode.TreeItemCollapsibleState.Collapsed, 'category', element.contextName),
                new BaseTreeItem('Configuration', vscode.TreeItemCollapsibleState.Collapsed, 'category', element.contextName),
                new BaseTreeItem('Network', vscode.TreeItemCollapsibleState.Collapsed, 'category', element.contextName),
                new BaseTreeItem('Namespaces', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'namespaces')
            ];
        }

        if (element.type === 'category' && element.label === 'Workloads') {
            return [
                new BaseTreeItem('Pods', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'pods'),
                new BaseTreeItem('Deployments', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'deployments'),
                new BaseTreeItem('Jobs', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'jobs')
            ];
        }

        if (element.type === 'category' && element.label === 'Configuration') {
            return [
                new BaseTreeItem('ConfigMaps', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'configmaps'),
                new BaseTreeItem('Secrets', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'secrets')
            ];
        }

        if (element.type === 'category' && element.label === 'Network') {
            return [
                new BaseTreeItem('Services', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'services'),
                new BaseTreeItem('Endpoints', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'endpoints'),
                new BaseTreeItem('Ingresses', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'ingresses'),
                new BaseTreeItem('Port Forwarding', vscode.TreeItemCollapsibleState.None, 'resource', element.contextName, 'portforwarding')
            ];
        }

        return [];
    }
}
