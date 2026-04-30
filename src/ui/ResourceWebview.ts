import * as vscode from 'vscode';
import * as k8s from '@kubernetes/client-node';
import { KubernetesClient, ActivePortForward } from '../kubernetes/kubernetesClient';
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
        } else if (node.resourceType === 'nodes' && node.contextName) {
            const nodesList = await kubeClient.getNodes(node.contextName);
            itemCount = nodesList.length;
            contentHtml = this.buildNodesTable(nodesList);
        } else if (node.resourceType === 'pods' && node.contextName) {
            const podsList = await kubeClient.getPodsAllNamespaces(node.contextName);
            itemCount = podsList.length;
            contentHtml = this.buildPodsTable(podsList);
        } else if (node.resourceType === 'deployments' && node.contextName) {
            const list = await kubeClient.getDeployments(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildDeploymentsTable(list);
        } else if (node.resourceType === 'jobs' && node.contextName) {
            const list = await kubeClient.getJobs(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildJobsTable(list);
        } else if (node.resourceType === 'configmaps' && node.contextName) {
            const list = await kubeClient.getConfigMaps(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildConfigMapsTable(list);
        } else if (node.resourceType === 'secrets' && node.contextName) {
            const list = await kubeClient.getSecrets(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildSecretsTable(list);
        } else if (node.resourceType === 'services' && node.contextName) {
            const list = await kubeClient.getServices(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildServicesTable(list);
        } else if (node.resourceType === 'endpoints' && node.contextName) {
            const list = await kubeClient.getEndpoints(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildEndpointsTable(list);
        } else if (node.resourceType === 'ingresses' && node.contextName) {
            const list = await kubeClient.getIngresses(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildIngressesTable(list);
        } else if (node.resourceType === 'portforwarding' && node.contextName) {
            const list = await kubeClient.getPortForwards(node.contextName);
            itemCount = list.length;
            contentHtml = this.buildPortForwardsTable(list);
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
        let rows = namespaces.map(ns => {
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
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (namespaces.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No namespaces found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Labels', 'Age', 'Status'], rows);
    }

    private static buildNodesTable(nodesList: k8s.V1Node[]): string {
        let rows = nodesList.map(n => {
            const name = n.metadata?.name || 'unknown';
            const ns = '';
            const version = n.status?.nodeInfo?.kubeletVersion || 'Unknown';
            const age = this.calculateAge(n.metadata?.creationTimestamp);

            let taintsHtml = '<span style="opacity:0.5;">0</span>';
            if (n.spec?.taints && n.spec.taints.length > 0) {
                const limit = 2;
                taintsHtml = n.spec.taints.slice(0, limit).map(t => {
                    const valueStr = t.value ? `=${t.value}` : '';
                    return `<span class="label-badge" style="background-color: var(--vscode-editorWarning-background); color: var(--vscode-editorWarning-foreground);">${t.key}${valueStr}:${t.effect}</span>`;
                }).join('');
                if (n.spec.taints.length > limit) {
                    taintsHtml += `<span class="label-badge">+${n.spec.taints.length - limit} more</span>`;
                }
            }

            let rolesHtml = '<span style="opacity:0.5;">&lt;none&gt;</span>';
            if (n.metadata?.labels) {
                const keys = Object.keys(n.metadata.labels);
                const roleKeys = keys.filter(k => k.startsWith('node-role.kubernetes.io/'));
                if (roleKeys.length > 0) {
                    rolesHtml = roleKeys.map(k => {
                        const roleName = k.replace('node-role.kubernetes.io/', '');
                        return `<span class="label-badge">${roleName}</span>`;
                    }).join('');
                }
            }

            let conditionsStr = 'Unknown';
            let statusClass = '';
            if (n.status?.conditions) {
                const readyCond = n.status.conditions.find(c => c.type === 'Ready');
                if (readyCond) {
                    if (readyCond.status === 'True') {
                        conditionsStr = 'Ready';
                        statusClass = 'status-active';
                    } else {
                        conditionsStr = 'NotReady';
                        statusClass = 'status-terminating';
                    }
                }
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="width: 25%; font-weight: bold;">${name}</td>
                    <td style="width: 25%;">${taintsHtml}</td>
                    <td style="width: 15%;">${rolesHtml}</td>
                    <td style="width: 10%;">${version}</td>
                    <td style="width: 10%;">${age}</td>
                    <td style="width: 10%;" class="${statusClass}">${conditionsStr}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (nodesList.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No nodes found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Taints', 'Roles', 'Version', 'Age', 'Conditions'], rows);
    }

    private static buildPodsTable(podsList: k8s.V1Pod[]): string {
        let rows = podsList.map(p => {
            const name = p.metadata?.name || 'unknown';
            const ns = p.metadata?.namespace || 'default';
            const age = this.calculateAge(p.metadata?.creationTimestamp);

            let containersHtml = '';
            let restarts = 0;
            if (p.status?.containerStatuses) {
                containersHtml = p.status.containerStatuses.map(cs => {
                    restarts += (cs.restartCount || 0);
                    return `<span class="container-square ${cs.ready ? 'ready' : ''}" title="${cs.name} (${cs.ready ? 'ready' : 'unready'})"></span>`;
                }).join('');
            }

            let ownerStr = '';
            if (p.metadata?.ownerReferences && p.metadata.ownerReferences.length > 0) {
                const o = p.metadata.ownerReferences[0];
                ownerStr = `<span style="opacity: 0.8;">${o.kind} / ${o.name}</span>`;
            }

            const nodeName = p.spec?.nodeName || '<span style="opacity:0.5;">&lt;none&gt;</span>';
            const qosStr = p.status?.qosClass || '';

            const phase = p.status?.phase || 'Unknown';
            let statusClass = '';
            if (phase === 'Running' || phase === 'Succeeded') {
                statusClass = 'status-active';
            } else if (phase === 'Failed' || phase === 'Error') {
                statusClass = 'status-terminating';
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td>${containersHtml}</td>
                    <td>${restarts}</td>
                    <td>${ownerStr}</td>
                    <td>${nodeName}</td>
                    <td>${qosStr}</td>
                    <td>${age}</td>
                    <td class="${statusClass}">${phase}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (podsList.length === 0) {
            rows = `<tr><td colspan="15" style="text-align: center; padding: 32px; opacity: 0.5;">No pods found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Containers', 'Restarts', 'Controlled By', 'Node', 'QoS', 'Age', 'Status'], rows);
    }

    private static buildDeploymentsTable(list: k8s.V1Deployment[]): string {
        let rows = list.map(d => {
            const name = d.metadata?.name || 'unknown';
            const ns = d.metadata?.namespace || 'default';
            const age = this.calculateAge(d.metadata?.creationTimestamp);

            const specReplicas = d.spec?.replicas || 0;
            const readyReplicas = d.status?.readyReplicas || 0;
            const currentReplicas = d.status?.replicas || 0;

            const podsStr = `${readyReplicas}/${specReplicas}`;

            let status = 'Unknown';
            let statusClass = '';

            const conds = d.status?.conditions || [];
            const availableCond = conds.find(c => c.type === 'Available');
            const progressingCond = conds.find(c => c.type === 'Progressing');

            if (availableCond && availableCond.status === 'True') {
                status = 'Active';
                statusClass = 'status-active';
                if (specReplicas === 0) {
                    status = 'Scaled Down';
                    statusClass = '';
                }
            } else if (progressingCond && progressingCond.status === 'True' && readyReplicas < specReplicas) {
                status = 'Updating';
                statusClass = '';
            } else {
                status = 'Failed/Pending';
                statusClass = 'status-terminating';
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td>${podsStr}</td>
                    <td>${currentReplicas}</td>
                    <td>${age}</td>
                    <td class="${statusClass}">${status}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No deployments found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Pods', 'Replicas', 'Age', 'Status'], rows);
    }

    private static buildJobsTable(list: k8s.V1Job[]): string {
        let rows = list.map(j => {
            const name = j.metadata?.name || 'unknown';
            const ns = j.metadata?.namespace || 'default';
            const age = this.calculateAge(j.metadata?.creationTimestamp);

            const succeeded = j.status?.succeeded || 0;
            const completions = j.spec?.completions || 1;
            const completionsStr = `${succeeded}/${completions}`;

            let status = 'Active';
            let statusClass = '';

            const conds = j.status?.conditions || [];
            const completeCond = conds.find(c => c.type === 'Complete');
            const failedCond = conds.find(c => c.type === 'Failed');

            if (completeCond && completeCond.status === 'True') {
                status = 'Complete';
                statusClass = 'status-active';
            } else if (failedCond && failedCond.status === 'True') {
                status = 'Failed';
                statusClass = 'status-terminating';
            } else if (j.status?.active && j.status.active > 0) {
                status = 'Running';
            } else {
                status = 'Pending';
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td>${completionsStr}</td>
                    <td>${age}</td>
                    <td class="${statusClass}">${status}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No jobs found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Completions', 'Age', 'Conditions'], rows);
    }

    private static buildConfigMapsTable(list: k8s.V1ConfigMap[]): string {
        let rows = list.map(cm => {
            const name = cm.metadata?.name || 'unknown';
            const ns = cm.metadata?.namespace || 'default';
            const age = this.calculateAge(cm.metadata?.creationTimestamp);

            const dataKeys = Object.keys(cm.data || {});
            const binaryDataKeys = Object.keys(cm.binaryData || {});
            const allKeys = [...dataKeys, ...binaryDataKeys];

            let keysHtml = '<span style="opacity:0.5;">0 keys</span>';
            if (allKeys.length > 0) {
                const limit = 3;
                keysHtml = allKeys.slice(0, limit).map(k => `<span class="label-badge">${k}</span>`).join('');
                if (allKeys.length > limit) {
                    keysHtml += `<span class="label-badge">+${allKeys.length - limit} more</span>`;
                }
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td style="width: 40%;">${keysHtml}</td>
                    <td>${age}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No config maps found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Keys', 'Age'], rows);
    }

    private static buildSecretsTable(list: k8s.V1Secret[]): string {
        let rows = list.map(s => {
            const name = s.metadata?.name || 'unknown';
            const ns = s.metadata?.namespace || 'default';
            const age = this.calculateAge(s.metadata?.creationTimestamp);
            const type = s.type || 'Opaque';

            let labelsHtml = '';
            if (s.metadata?.labels) {
                const limit = 2;
                const keys = Object.keys(s.metadata.labels);
                labelsHtml = keys.slice(0, limit).map(k => `<span class="label-badge">${k}=${s.metadata!.labels![k]}</span>`).join('');
                if (keys.length > limit) {
                    labelsHtml += `<span class="label-badge">+${keys.length - limit} more</span>`;
                }
            }

            const dataKeys = Object.keys(s.data || {});
            const stringDataKeys = Object.keys(s.stringData || {});
            const allKeys = [...new Set([...dataKeys, ...stringDataKeys])];

            let keysHtml = '<span style="opacity:0.5;">0 keys</span>';
            if (allKeys.length > 0) {
                const limit = 3;
                keysHtml = allKeys.slice(0, limit).map(k => `<span class="label-badge">${k}</span>`).join('');
                if (allKeys.length > limit) {
                    keysHtml += `<span class="label-badge">+${allKeys.length - limit} more</span>`;
                }
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td>${labelsHtml}</td>
                    <td style="width: 20%;">${keysHtml}</td>
                    <td>${type}</td>
                    <td>${age}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No secrets found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Labels', 'Keys', 'Type', 'Age'], rows);
    }

    private static buildServicesTable(list: k8s.V1Service[]): string {
        let rows = list.map(s => {
            const name = s.metadata?.name || 'unknown';
            const ns = s.metadata?.namespace || 'default';
            const age = this.calculateAge(s.metadata?.creationTimestamp);
            const type = s.spec?.type || 'ClusterIP';
            const clusterIP = s.spec?.clusterIP || '<span style="opacity:0.5;">None</span>';

            let portsHtml = '<span style="opacity:0.5;">&lt;none&gt;</span>';
            if (s.spec?.ports && s.spec.ports.length > 0) {
                const limit = 2;
                portsHtml = s.spec.ports.slice(0, limit).map(p => {
                    let portStr = `${p.port}`;
                    if (p.nodePort) portStr += `:${p.nodePort}`;
                    portStr += `/${p.protocol || 'TCP'}`;
                    return `<span class="label-badge">${portStr}</span>`;
                }).join('');
                if (s.spec.ports.length > limit) {
                    portsHtml += `<span class="label-badge">+${s.spec.ports.length - limit} more</span>`;
                }
            }

            let externalIps: string[] = [];
            if (s.spec?.externalIPs) externalIps.push(...s.spec.externalIPs);
            if (s.status?.loadBalancer?.ingress) {
                s.status.loadBalancer.ingress.forEach(ing => {
                    if (ing.ip) externalIps.push(ing.ip);
                    if (ing.hostname) externalIps.push(ing.hostname);
                });
            }
            const externalIpHtml = externalIps.length > 0 ? externalIps.join(', ') : '<span style="opacity:0.5;">&lt;none&gt;</span>';

            let selectorHtml = '<span style="opacity:0.5;">&lt;none&gt;</span>';
            if (s.spec?.selector) {
                const limit = 2;
                const keys = Object.keys(s.spec.selector);
                if (keys.length > 0) {
                    selectorHtml = keys.slice(0, limit).map(k => `<span class="label-badge">${k}=${s.spec!.selector![k]}</span>`).join('');
                    if (keys.length > limit) {
                        selectorHtml += `<span class="label-badge">+${keys.length - limit} more</span>`;
                    }
                }
            }

            let status = 'Active';
            let statusClass = 'status-active';
            if (type === 'LoadBalancer' && externalIps.length === 0) {
                status = 'Pending';
                statusClass = '';
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td>${type}</td>
                    <td>${clusterIP}</td>
                    <td>${portsHtml}</td>
                    <td>${externalIpHtml}</td>
                    <td>${selectorHtml}</td>
                    <td>${age}</td>
                    <td class="${statusClass}">${status}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="15" style="text-align: center; padding: 32px; opacity: 0.5;">No services found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Type', 'Cluster IP', 'Ports', 'External IP', 'Selector', 'Age', 'Status'], rows);
    }

    private static buildEndpointsTable(list: k8s.V1Endpoints[]): string {
        let rows = list.map(ep => {
            const name = ep.metadata?.name || 'unknown';
            const ns = ep.metadata?.namespace || 'default';
            const age = this.calculateAge(ep.metadata?.creationTimestamp);

            let endpointIps: string[] = [];
            if (ep.subsets) {
                ep.subsets.forEach(subset => {
                    const addresses = subset.addresses || [];
                    const ports = subset.ports || [];

                    if (addresses.length > 0 && ports.length > 0) {
                        addresses.forEach(addr => {
                            ports.forEach(port => {
                                endpointIps.push(`${addr.ip}:${port.port}`);
                            });
                        });
                    } else if (addresses.length > 0) {
                        addresses.forEach(addr => endpointIps.push(addr.ip));
                    }
                });
            }

            let endpointsHtml = '<span style="opacity:0.5;">&lt;none&gt;</span>';
            if (endpointIps.length > 0) {
                const limit = 3;
                endpointsHtml = endpointIps.slice(0, limit).map(ip => `<span class="label-badge">${ip}</span>`).join('');
                if (endpointIps.length > limit) {
                    endpointsHtml += `<span class="label-badge">+${endpointIps.length - limit} more</span>`;
                }
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td style="width: 50%;">${endpointsHtml}</td>
                    <td>${age}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No endpoints found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Endpoints', 'Age'], rows);
    }

    private static buildIngressesTable(list: k8s.V1Ingress[]): string {
        let rows = list.map(i => {
            const name = i.metadata?.name || 'unknown';
            const ns = i.metadata?.namespace || 'default';
            const age = this.calculateAge(i.metadata?.creationTimestamp);

            let lbs: string[] = [];
            if (i.status?.loadBalancer?.ingress) {
                i.status.loadBalancer.ingress.forEach(ing => {
                    if (ing.ip) lbs.push(ing.ip);
                    if (ing.hostname) lbs.push(ing.hostname);
                });
            }
            let lbsHtml = '<span style="opacity:0.5;">&lt;none&gt;</span>';
            if (lbs.length > 0) {
                const limit = 2;
                lbsHtml = lbs.slice(0, limit).map(v => `<span class="label-badge">${v}</span>`).join('');
                if (lbs.length > limit) {
                    lbsHtml += `<span class="label-badge">+${lbs.length - limit} more</span>`;
                }
            }

            let ruleStrings: string[] = [];
            if (i.spec?.rules) {
                i.spec.rules.forEach(r => {
                    const host = r.host || '*';
                    if (r.http?.paths && r.http.paths.length > 0) {
                        r.http.paths.forEach(p => {
                            ruleStrings.push(`${host}${p.path || ''}`);
                        });
                    } else {
                        ruleStrings.push(host);
                    }
                });
            } else if (i.spec?.defaultBackend) {
                ruleStrings.push('Default Backend');
            }

            let rulesHtml = '<span style="opacity:0.5;">&lt;none&gt;</span>';
            if (ruleStrings.length > 0) {
                const limit = 3;
                rulesHtml = ruleStrings.slice(0, limit).map(v => `<span class="label-badge">${v}</span>`).join('');
                if (ruleStrings.length > limit) {
                    rulesHtml += `<span class="label-badge">+${ruleStrings.length - limit} more</span>`;
                }
            }

            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${name}</td>
                    <td>${ns}</td>
                    <td>${lbsHtml}</td>
                    <td>${rulesHtml}</td>
                    <td>${age}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No ingresses found</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'LoadBalancers', 'Rules', 'Age'], rows);
    }

    private static buildPortForwardsTable(list: ActivePortForward[]): string {
        let rows = list.map(pf => {
            const name = pf.name;
            const ns = pf.namespace;
            const statusClass = pf.status === 'Active' ? 'status-active' : (pf.status === 'Failed' ? 'status-terminating' : '');
            return `
                <tr class="searchable-row">
                    <td><div class="checkbox"></div></td>
                    <td style="font-weight: bold;">${pf.name}</td>
                    <td>${pf.namespace}</td>
                    <td>${pf.kind}</td>
                    <td>${pf.podPort}</td>
                    <td>${pf.localPort}</td>
                    <td>${pf.protocol}</td>
                    <td class="${statusClass}">${pf.status}</td>
                    <td style="width: 40px; text-align:right;"><details class="action-menu">
                        <summary class="action-btn" title="Actions">
                            <i class="codicon codicon-kebab-vertical"></i>
                        </summary>
                        <div class="action-dropdown">
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'edit', name: '${name}', namespace: '${ns}'})">Edit</div>
                            <div class="action-dropdown-item" onclick="vscode.postMessage({command: 'delete', name: '${name}', namespace: '${ns}'})">Delete</div>
                        </div>
                    </details></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="10" style="text-align: center; padding: 32px; opacity: 0.5;">No active port forwarding sessions</td></tr>`;
        }

        return TableComponent.getHtml(['Name', 'Namespace', 'Kind', 'Pod Port', 'Local Port', 'Protocol', 'Status'], rows);
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
