import { KubernetesClient } from '../kubernetes/kubernetesClient';
import * as k8s from '@kubernetes/client-node';

export interface AnalysisExplanation {
    issue: string;
    confidence: number;
    evidence: string[];
    fix: string;
}

export class AnalysisEngine {
    public static async explainPod(pod: k8s.V1Pod, namespace: string, kubeClient: KubernetesClient): Promise<AnalysisExplanation> {
        let logs = "";
        let restartCount = 0;

        if (pod.metadata?.name) {
            logs = await kubeClient.getPodLogs(namespace, pod.metadata.name);
        }

        if (pod.status?.containerStatuses && pod.status.containerStatuses.length > 0) {
            restartCount = pod.status.containerStatuses.reduce((acc, current) => acc + current.restartCount, 0);
        }

        return this.analyzeLogsAndState(logs, pod.status?.phase || 'Unknown', restartCount);
    }

    public static analyzeLogsAndState(logs: string, status: string, restartCount: number): AnalysisExplanation {
        // 1. Crash loop detection
        if (restartCount > 3 || status === 'CrashLoopBackOff') {
            return {
                issue: "Crash Loop Backoff",
                confidence: 0.9,
                evidence: [`Restart count: ${restartCount}`, `Status indicates crash loop: ${status}`],
                fix: "Check the application startup logs. The application is failing immediately upon start."
            };
        }

        // 2. Port conflict detection
        if (logs.toLowerCase().includes("address already in use") || logs.toLowerCase().includes("bind: address already in use") || logs.toLowerCase().includes("port in use")) {
            return {
                issue: "Port Conflict",
                confidence: 0.95,
                evidence: ["Logs indicate a port bind issue (address already in use)"],
                fix: "Check the pod configuration for conflicting ports."
            };
        }

        // 3. Missing Env Var
        if (logs.toLowerCase().includes("undefined variable") || logs.toLowerCase().includes("missing required environment variable")) {
            return {
                issue: "Missing Environment Variable",
                confidence: 0.85,
                evidence: ["Logs indicate missing required variables"],
                fix: "Provide the missing environment variables updating the config file / Kubernetes Secret."
            };
        }

        // 4. Connection refused / dependency issue
        if (logs.toLowerCase().includes("connection refused") || logs.toLowerCase().includes("econnrefused")) {
            return {
                issue: "Dependency Unreachable",
                confidence: 0.80,
                evidence: ["Logs contain connection refused errors"],
                fix: "Ensure all dependent services (database, APIs, etc.) are running and reachable using the correct network / service."
            };
        }

        // Fallback for healthy or unknown issues
        if (status.toLowerCase().includes("up") || status.toLowerCase().includes("running")) {
            return {
                issue: "No obvious failure detected",
                confidence: 0.6,
                evidence: [`Status: ${status}`, "Resource appears to be running normally"],
                fix: "Check application specific logs for logical errors if something isn't working."
            };
        }

        return {
            issue: "Unknown Exit / Failure",
            confidence: 0.4,
            evidence: [`Status: ${status}`],
            fix: "Review the full logs to understand why the resource exited."
        };
    }
}
