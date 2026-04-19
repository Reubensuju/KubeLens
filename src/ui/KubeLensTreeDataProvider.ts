import * as vscode from 'vscode';
import { DockerClient } from '../docker/dockerClient';
import { KubernetesClient } from '../kubernetes/kubernetesClient';
import * as k8s from '@kubernetes/client-node';

export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'root' | 'docker-container' | 'cluster' | 'namespace' | 'pod' | 'error',
        public readonly resourceId?: string,
        public readonly parentResourceId?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
    }
}

export class ContainerTreeItem extends BaseTreeItem {
    constructor(
        label: string,
        public readonly status: string,
        public readonly image: string,
        public readonly containerId: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None, 'docker-container', containerId);
        this.tooltip = `${this.label}\nStatus: ${this.status}\nImage: ${this.image}`;
        this.description = status;

        if (status.toLowerCase().includes('up') || status.toLowerCase().includes('running')) {
            this.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('testing.iconPassed'));
        } else if (status.toLowerCase().includes('exited') || status.toLowerCase().includes('created')) {
            this.iconPath = new vscode.ThemeIcon('stop-circle', new vscode.ThemeColor('testing.iconFailed'));
        } else {
            this.iconPath = new vscode.ThemeIcon('question');
        }
    }
}

export class PodTreeItem extends BaseTreeItem {
    constructor(
        public readonly pod: k8s.V1Pod,
        public readonly namespace: string
    ) {
        super(pod.metadata?.name || 'unknown', vscode.TreeItemCollapsibleState.None, 'pod', pod.metadata?.name, namespace);
        const status = pod.status?.phase || 'Unknown';
        this.description = status;
        this.tooltip = `Pod: ${this.label}\nStatus: ${status}`;

        if (status === 'Running' || status === 'Succeeded') {
            this.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('testing.iconPassed'));
        } else if (status === 'Failed' || status === 'CrashLoopBackOff' || status === 'Pending') {
            this.iconPath = new vscode.ThemeIcon('stop-circle', new vscode.ThemeColor('testing.iconFailed'));
        } else {
            this.iconPath = new vscode.ThemeIcon('question');
        }
    }
}

export class KubeLensTreeDataProvider implements vscode.TreeDataProvider<BaseTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BaseTreeItem | undefined | void> = new vscode.EventEmitter<BaseTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BaseTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    public kubeClient: KubernetesClient;

    constructor(private readonly viewType: 'docker' | 'kubernetes') {
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
            if (this.viewType === 'docker') {
                const containers = await DockerClient.getContainers();
                if (containers === null) {
                    return [new BaseTreeItem('Docker is offline - Please start Docker Desktop', vscode.TreeItemCollapsibleState.None, 'error')];
                }
                if (containers.length === 0) {
                    return [new BaseTreeItem('No containers found', vscode.TreeItemCollapsibleState.None, 'error')];
                }
                return containers.map(c => new ContainerTreeItem(c.name, c.status, c.image, c.id));
            } else {
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
        }

        if (element.type === 'cluster') {
            const namespaces = await this.kubeClient.getNamespaces(element.resourceId!);
            return namespaces.map(ns => new BaseTreeItem(ns, vscode.TreeItemCollapsibleState.Collapsed, 'namespace', ns, element.resourceId));
        }

        if (element.type === 'namespace') {
            const pods = await this.kubeClient.getPods(element.resourceId!);
            if (pods.length === 0) {
                return [new BaseTreeItem('No pods found in namespace', vscode.TreeItemCollapsibleState.None, 'error')];
            }
            return pods.map(p => new PodTreeItem(p, element.resourceId!));
        }

        return [];
    }
}
