import * as k8s from '@kubernetes/client-node';

export class KubernetesClient {
    public kc: k8s.KubeConfig;
    public k8sApi: k8s.CoreV1Api | null = null;

    constructor() {
        this.kc = new k8s.KubeConfig();
        try {
            this.kc.loadFromDefault();
            this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        } catch (e) {
            console.error('Failed to load kubeconfig', e);
        }
    }

    public isConfigured(): boolean {
        return this.k8sApi !== null;
    }

    public getContexts(): string[] {
        if (!this.isConfigured()) return [];
        return this.kc.contexts.map(c => c.name);
    }

    public getCurrentContext(): string | null {
        if (!this.isConfigured()) return null;
        return this.kc.getCurrentContext();
    }

    public async getNamespacesFull(contextName: string): Promise<k8s.V1Namespace[]> {
        if (!this.k8sApi) return [];
        try {
            this.kc.setCurrentContext(contextName);
            this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await this.k8sApi.listNamespace();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list namespaces full', e);
            return [];
        }
    }

    public async getSecrets(contextName: string): Promise<k8s.V1Secret[]> {
        try {
            this.kc.setCurrentContext(contextName);
            const coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await coreApi.listSecretForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list secrets', e);
            return [];
        }
    }

    public async getServices(contextName: string): Promise<k8s.V1Service[]> {
        try {
            this.kc.setCurrentContext(contextName);
            const coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await coreApi.listServiceForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list services', e);
            return [];
        }
    }

    public async getIngresses(contextName: string): Promise<k8s.V1Ingress[]> {
        try {
            this.kc.setCurrentContext(contextName);
            const netApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
            const res = await netApi.listIngressForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list ingresses', e);
            return [];
        }
    }

    public async getEndpoints(contextName: string): Promise<k8s.V1Endpoints[]> {
        try {
            this.kc.setCurrentContext(contextName);
            const coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await coreApi.listEndpointsForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list endpoints', e);
            return [];
        }
    }

    public async getConfigMaps(contextName: string): Promise<k8s.V1ConfigMap[]> {
        try {
            this.kc.setCurrentContext(contextName);
            const coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await coreApi.listConfigMapForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list configmaps', e);
            return [];
        }
    }

    public async getJobs(contextName: string): Promise<k8s.V1Job[]> {
        try {
            this.kc.setCurrentContext(contextName);
            const batchApi = this.kc.makeApiClient(k8s.BatchV1Api);
            const res = await batchApi.listJobForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list jobs', e);
            return [];
        }
    }

    public async getDeployments(contextName: string): Promise<k8s.V1Deployment[]> {
        try {
            this.kc.setCurrentContext(contextName);
            const appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
            const res = await appsApi.listDeploymentForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list deployments', e);
            return [];
        }
    }

    public async getPodsAllNamespaces(contextName: string): Promise<k8s.V1Pod[]> {
        if (!this.k8sApi) return [];
        try {
            this.kc.setCurrentContext(contextName);
            this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await this.k8sApi.listPodForAllNamespaces();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list pods', e);
            return [];
        }
    }

    public async getNodes(contextName: string): Promise<k8s.V1Node[]> {
        if (!this.k8sApi) return [];
        try {
            this.kc.setCurrentContext(contextName);
            this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await this.k8sApi.listNode();
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list nodes', e);
            return [];
        }
    }

    public async getNamespaces(contextName: string): Promise<string[]> {
        if (!this.k8sApi) return [];
        try {
            this.kc.setCurrentContext(contextName);
            this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
            const res = await this.k8sApi.listNamespace();
            return (res as any).items.map((ns: any) => ns.metadata?.name || 'unknown');
        } catch (e) {
            console.error('Failed to list namespaces', e);
            return [];
        }
    }

    public async getPods(namespace: string): Promise<k8s.V1Pod[]> {
        if (!this.k8sApi) return [];
        try {
            const res = await this.k8sApi.listNamespacedPod({ namespace });
            return (res as any).items;
        } catch (e) {
            console.error('Failed to list pods for namespace', namespace, e);
            return [];
        }
    }

    public async getPodLogs(namespace: string, podName: string): Promise<string> {
        if (!this.k8sApi) return "";
        try {
            const res = await this.k8sApi.readNamespacedPodLog({ name: podName, namespace, tailLines: 200 });
            return typeof res === 'string' ? res : (res as any).toString();
        } catch (e) {
            return `Failed to fetch pod logs: ${(e as Error).message}`;
        }
    }
}
