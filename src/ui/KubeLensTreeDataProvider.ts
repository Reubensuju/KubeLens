import * as vscode from 'vscode';
import { DockerClient } from '../docker/dockerClient';

export class ContainerTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly status: string,
        public readonly image: string,
        public readonly containerId: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label}\nStatus: ${this.status}\nImage: ${this.image}`;
        this.description = status;
        this.contextValue = 'container';
        if (status.includes('Up')) {
            this.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('testing.iconPassed'));
        } else if (status.includes('Exited')) {
            this.iconPath = new vscode.ThemeIcon('stop-circle', new vscode.ThemeColor('testing.iconFailed'));
        } else {
            this.iconPath = new vscode.ThemeIcon('question');
        }
    }
}

export class KubeLensTreeDataProvider implements vscode.TreeDataProvider<ContainerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ContainerTreeItem | undefined | void> = new vscode.EventEmitter<ContainerTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ContainerTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ContainerTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ContainerTreeItem): Thenable<ContainerTreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            return DockerClient.getContainers().then(containers => {
                if (containers === null) {
                    return [new ContainerTreeItem(
                        'Docker is offline',
                        'Please start Docker Desktop.',
                        '',
                        '',
                        vscode.TreeItemCollapsibleState.None
                    )];
                }

                if (containers.length === 0) {
                    return [new ContainerTreeItem(
                        'No containers found',
                        'Start a container to analyze it.',
                        '',
                        '',
                        vscode.TreeItemCollapsibleState.None
                    )];
                }

                return containers.map(c => new ContainerTreeItem(
                    c.name,
                    c.status,
                    c.image,
                    c.id,
                    vscode.TreeItemCollapsibleState.None
                ));
            });
        }
    }
}
