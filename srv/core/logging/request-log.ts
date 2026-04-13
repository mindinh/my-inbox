import { Request as ExpressRequest } from 'express';
import { AuthRuntimeConfig } from '../config/auth-mode';
import { AppRequestContext } from '../context/app-request-context';

interface LogPayload {
    [key: string]: unknown;
}

export function logStartupAuthContext(config: AuthRuntimeConfig): void {
    logInfo('app.startup.auth_context', {
        authMode: config.authMode,
        destinationName: config.destinationName,
        propagationExpected: config.propagationExpected,
        environment: config.environment,
        serviceName: config.serviceName,
    });
}

export function logRequestReceived(req: ExpressRequest, appContext: AppRequestContext): void {
    logInfo('request.received', {
        requestId: appContext.requestId,
        operationName: appContext.operationName,
        method: req.method,
        path: req.path,
        isAuthenticated: appContext.isAuthenticated,
        userId: appContext.user.id,
    });
}

export function logRequestContextBuilt(appContext: AppRequestContext): void {
    logInfo('request.context.built', {
        requestId: appContext.requestId,
        operationName: appContext.operationName,
        userId: appContext.user.id,
        hasEmail: Boolean(appContext.user.email),
        roleCount: appContext.user.roles.length,
    });
}

function logInfo(event: string, payload: LogPayload): void {
    console.info(JSON.stringify({ event, ...payload }));
}
