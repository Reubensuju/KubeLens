import { DockerClient } from '../docker/dockerClient';

export interface AnalysisExplanation {
    issue: string;
    confidence: number;
    evidence: string[];
    fix: string;
}

export class AnalysisEngine {
    public static async explainContainer(containerId: string, containerName: string, state: string, status: string): Promise<AnalysisExplanation> {
        // Fetch logs and inspect data
        const logs = await DockerClient.getLogs(containerId, 200);
        const metadata = await DockerClient.inspect(containerId);

        // 1. Crash loop detection
        if (metadata && metadata.State && metadata.State.Restarting) {
            return {
                issue: "Crash Loop Backoff",
                confidence: 0.9,
                evidence: [`Restart count: ${metadata.RestartCount}`, "Container is in Restarting state"],
                fix: "Check the application startup logs. The application is failing immediately upon start."
            };
        }

        // 2. Port conflict detection
        if (logs.toLowerCase().includes("address already in use") || logs.toLowerCase().includes("bind: address already in use") || logs.toLowerCase().includes("port in use")) {
            return {
                issue: "Port Conflict",
                confidence: 0.95,
                evidence: ["Logs indicate a port bind issue (address already in use)"],
                fix: "Change the port mapping in docker run/compose or stop the conflicting service on your host."
            };
        }

        // 3. Missing Env Var
        if (logs.toLowerCase().includes("undefined variable") || logs.toLowerCase().includes("missing required environment variable")) {
            return {
                issue: "Missing Environment Variable",
                confidence: 0.85,
                evidence: ["Logs indicate missing required variables"],
                fix: "Provide the missing environment variables using -e flag or updating the config file."
            };
        }

        // 4. Connection refused / dependency issue
        if (logs.toLowerCase().includes("connection refused") || logs.toLowerCase().includes("econnrefused")) {
            return {
                issue: "Dependency Unreachable",
                confidence: 0.80,
                evidence: ["Logs contain connection refused errors"],
                fix: "Ensure all dependent services (database, APIs, etc.) are running and reachable using the correct network."
            };
        }

        // Fallback for healthy or unknown issues
        if (status.toLowerCase().includes("up")) {
            return {
                issue: "No obvious failure detected",
                confidence: 0.6,
                evidence: [`Status: ${status}`, "Container appears to be running normally"],
                fix: "Check application specific logs for logical errors if something isn't working."
            };
        }

        return {
            issue: "Unknown Exit / Failure",
            confidence: 0.4,
            evidence: [`Status: ${status}`, `Metadata state: ${metadata?.State?.Status || 'Unknown'}`],
            fix: "Review the full logs to understand why the container exited."
        };
    }
}
