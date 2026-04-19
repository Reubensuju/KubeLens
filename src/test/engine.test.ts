import { expect } from 'chai';
import { AnalysisEngine } from '../analysis/engine';

describe('Analysis Engine Log Heuristics', () => {

    it('identifies crash loops properly from restart count', () => {
        const result = AnalysisEngine.analyzeLogsAndState("some random logs", "CrashLoopBackOff", 4);
        expect(result.issue).to.equal("Crash Loop Backoff");
        expect(result.confidence).to.be.greaterThan(0.8);
    });

    it('detects port conflicts regardless of casing', () => {
        const result = AnalysisEngine.analyzeLogsAndState("... EADDRINUSE: bind: address already in use ...", "Error", 1);
        expect(result.issue).to.equal("Port Conflict");
        expect(result.fix).to.include("conflicting ports");
    });

    it('flags missing environment variables', () => {
        const result = AnalysisEngine.analyzeLogsAndState("Config panic: missing required environment variable DB_PASSWORD", "Error", 0);
        expect(result.issue).to.equal("Missing Environment Variable");
    });

    it('diagnoses connection refused network requests', () => {
        const result = AnalysisEngine.analyzeLogsAndState("Connecting ... Econnrefused: 10.2.1.4:5432 unreachable", "Error", 1);
        expect(result.issue).to.equal("Dependency Unreachable");
    });

    it('falls back to healthy running state properly', () => {
        const result = AnalysisEngine.analyzeLogsAndState("Normal application output", "Running", 0);
        expect(result.issue).to.equal("No obvious failure detected");
        expect(result.confidence).to.be.lessThan(0.7);
    });

    it('defaults to unknown failure appropriately', () => {
        const result = AnalysisEngine.analyzeLogsAndState("Segmentation fault", "OOMKilled", 1);
        expect(result.issue).to.equal("Unknown Exit / Failure");
    });
});
