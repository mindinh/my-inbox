import { AppRequestContext } from '../context/app-request-context';
import { SAPExecutionContext } from '../context/sap-execution-context';

interface SapErrorSummary {
    httpStatus?: number;
    errorCode?: string;
    safeMessage: string;
}

interface SapReadFinishedInput {
    appContext: AppRequestContext;
    sapContext: SAPExecutionContext;
    sapOperation: string;
    status: 'success' | 'error';
    latencyMs: number;
}

interface SapDecisionLogInput {
    appContext: AppRequestContext;
    sapContext: SAPExecutionContext;
    decision: string;
    taskIdSummary: string;
}

interface SapDecisionFinishedInput extends SapDecisionLogInput {
    status: 'success' | 'error';
    latencyMs: number;
}

export function logSapExecutionContextBuilt(
    appContext: AppRequestContext,
    sapContext: SAPExecutionContext
): void {
    logInfo('sap.execution_context.built', {
        requestId: appContext.requestId,
        operationName: appContext.operationName,
        destinationName: sapContext.destinationName,
        authMode: sapContext.authMode,
        propagationExpected: sapContext.propagationExpected,
        hasUserContext: sapContext.hasUserContext,
        userId: sapContext.userId,
    });
}

export function logSapReadStarted(
    appContext: AppRequestContext,
    sapContext: SAPExecutionContext,
    sapOperation: string
): void {
    logInfo('sap.read.started', {
        requestId: appContext.requestId,
        operationName: appContext.operationName,
        destinationName: sapContext.destinationName,
        authMode: sapContext.authMode,
        sapOperation,
    });
}

export function logSapReadFinished(input: SapReadFinishedInput): void {
    logInfo('sap.read.finished', {
        requestId: input.appContext.requestId,
        operationName: input.appContext.operationName,
        sapOperation: input.sapOperation,
        status: input.status,
        latencyMs: input.latencyMs,
    });
}

export function logSapDecisionStarted(input: SapDecisionLogInput): void {
    logInfo('sap.decision.started', {
        requestId: input.appContext.requestId,
        operationName: input.appContext.operationName,
        decision: input.decision,
        taskIdSummary: input.taskIdSummary,
        destinationName: input.sapContext.destinationName,
        authMode: input.sapContext.authMode,
        propagationExpected: input.sapContext.propagationExpected,
        userId: input.sapContext.userId,
    });
}

export function logSapDecisionFinished(input: SapDecisionFinishedInput): void {
    logInfo('sap.decision.finished', {
        requestId: input.appContext.requestId,
        operationName: input.appContext.operationName,
        decision: input.decision,
        status: input.status,
        latencyMs: input.latencyMs,
    });
}

export function logSapDecisionFailed(
    appContext: AppRequestContext,
    sapContext: SAPExecutionContext,
    decision: string,
    error: unknown
): void {
    const summary = toSafeErrorSummary(error);
    logError('sap.decision.failed', {
        requestId: appContext.requestId,
        operationName: appContext.operationName,
        decision,
        destinationName: sapContext.destinationName,
        authMode: sapContext.authMode,
        httpStatus: summary.httpStatus,
        errorCode: summary.errorCode,
        safeMessage: summary.safeMessage,
    });
}

export function toSafeErrorSummary(error: unknown): SapErrorSummary {
    const err = asErrorLike(error);
    const status = extractHttpStatus(err);

    return {
        httpStatus: status,
        errorCode: readString(err.code),
        safeMessage: readString(err.message) || 'Unknown SAP error',
    };
}

function extractHttpStatus(err: Record<string, unknown>): number | undefined {
    const response = asRecord(err.response);
    if (typeof response.status === 'number') {
        return response.status;
    }

    const cause = asRecord(err.cause);
    const causeResponse = asRecord(cause.response);
    if (typeof causeResponse.status === 'number') {
        return causeResponse.status;
    }

    if (typeof err.status === 'number') return err.status;
    if (typeof err.statusCode === 'number') return err.statusCode;
    return undefined;
}

function asErrorLike(error: unknown): Record<string, unknown> {
    if (!error || typeof error !== 'object') {
        return { message: String(error) };
    }
    return error as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function logInfo(event: string, payload: Record<string, unknown>): void {
    console.info(JSON.stringify({ event, ...payload }));
}

function logError(event: string, payload: Record<string, unknown>): void {
    console.error(JSON.stringify({ event, ...payload }));
}
