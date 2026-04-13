import { AppRequestContext } from '../../core/context/app-request-context';
import { SAPExecutionContext } from '../../core/context/sap-execution-context';
import {
    logSapDecisionFailed,
    logSapDecisionFinished,
    logSapDecisionStarted,
} from '../../core/logging/sap-call-log';

export type DecisionKind = 'approve' | 'reject' | 'other';

interface ExecuteTaskDecisionOptions<T> {
    appContext: AppRequestContext;
    sapContext: SAPExecutionContext;
    decision: DecisionKind | string;
    taskIdentifiers: {
        instanceId: string;
        sapOrigin?: string;
        documentId?: string;
    };
    execute: () => Promise<T>;
}

export async function executeTaskDecisionBoundary<T>(
    options: ExecuteTaskDecisionOptions<T>
): Promise<T> {
    const startedAt = Date.now();
    const taskIdSummary = formatTaskIdSummary(options.taskIdentifiers);

    logSapDecisionStarted({
        appContext: options.appContext,
        sapContext: options.sapContext,
        decision: options.decision,
        taskIdSummary,
    });

    try {
        const result = await options.execute();
        logSapDecisionFinished({
            appContext: options.appContext,
            sapContext: options.sapContext,
            decision: options.decision,
            status: 'success',
            latencyMs: Date.now() - startedAt,
            taskIdSummary,
        });
        return result;
    } catch (error) {
        logSapDecisionFinished({
            appContext: options.appContext,
            sapContext: options.sapContext,
            decision: options.decision,
            status: 'error',
            latencyMs: Date.now() - startedAt,
            taskIdSummary,
        });
        logSapDecisionFailed(options.appContext, options.sapContext, String(options.decision), error);
        throw error;
    }
}

export function inferDecisionKind(decisionKey?: string, decisionType?: string): DecisionKind {
    const normalizedType = (decisionType || '').trim().toUpperCase();
    if (normalizedType === 'REJ' || normalizedType === 'REJECT') return 'reject';
    if (normalizedType === 'APPR' || normalizedType === 'APPROVE') return 'approve';

    const normalizedKey = (decisionKey || '').trim().toUpperCase();
    if (normalizedKey.includes('REJ') || normalizedKey.includes('REJECT')) return 'reject';
    if (normalizedKey.includes('APPR') || normalizedKey.includes('APPROVE')) return 'approve';

    return 'other';
}

function formatTaskIdSummary(taskIdentifiers: {
    instanceId: string;
    sapOrigin?: string;
    documentId?: string;
}): string {
    const parts = [`instanceId=${taskIdentifiers.instanceId}`];
    if (taskIdentifiers.sapOrigin) parts.push(`sapOrigin=${taskIdentifiers.sapOrigin}`);
    if (taskIdentifiers.documentId) parts.push(`documentId=${taskIdentifiers.documentId}`);
    return parts.join(', ');
}
