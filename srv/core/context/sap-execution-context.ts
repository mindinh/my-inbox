import { InboxIdentity } from '../../types';
import { AuthMode, AuthRuntimeConfig, resolveAuthRuntimeConfig } from '../config/auth-mode';
import { AppRequestContext } from './app-request-context';

export interface SAPExecutionContext {
    requestId: string;
    operationName: string;
    destinationName: string;
    authMode: AuthMode;
    propagationExpected: boolean;
    hasUserContext: boolean;
    userId?: string;
    sapUser: string;
    isImpersonated: boolean;
    userJwt?: string;
}

const DEFAULT_SAP_USER = 'DEMO_USER';
const DEFAULT_BTP_USER = 'anonymous';

export function buildSAPExecutionContext(
    appContext: AppRequestContext,
    config: AuthRuntimeConfig = resolveAuthRuntimeConfig(),
    env: NodeJS.ProcessEnv = process.env
): SAPExecutionContext {
    const resolved = resolveSapUser(appContext, env);

    return {
        requestId: appContext.requestId,
        operationName: appContext.operationName,
        destinationName: config.destinationName,
        authMode: config.authMode,
        propagationExpected: config.propagationExpected,
        hasUserContext: Boolean(appContext.auth.userJwt),
        userId: appContext.user.id,
        sapUser: resolved.sapUser,
        isImpersonated: resolved.isImpersonated,
        userJwt: appContext.auth.userJwt,
    };
}

export function toInboxIdentity(
    appContext: AppRequestContext,
    sapContext: SAPExecutionContext
): InboxIdentity {
    return {
        btpUser: appContext.user.id || appContext.user.email || DEFAULT_BTP_USER,
        sapUser: sapContext.sapUser,
        isImpersonated: sapContext.isImpersonated,
        userJwt: sapContext.userJwt,
    };
}

export function assertSapUserFromExecutionContext(sapContext: SAPExecutionContext): void {
    if (sapContext.authMode === 'mock') {
        return;
    }

    const normalizedSapUser = sapContext.sapUser?.trim().toUpperCase();
    const fallbackUsers = new Set([DEFAULT_SAP_USER, DEFAULT_BTP_USER.toUpperCase()]);

    if (!normalizedSapUser || fallbackUsers.has(normalizedSapUser)) {
        throw new Error(
            `No SAP user resolved. Set x-sap-user header or SAP_DEFAULT_USER env variable, or verify principal propagation user mapping in Cloud Connector. BTP user: ${sapContext.userId || DEFAULT_BTP_USER}`
        );
    }
}

function resolveSapUser(
    appContext: AppRequestContext,
    env: NodeJS.ProcessEnv
): { sapUser: string; isImpersonated: boolean } {
    const headerOverride = appContext.user.sapUserOverride;
    const envDefault = env.SAP_DEFAULT_USER || env.SAP_TASK_HARDCODED_USER;
    const defaultUser = appContext.user.id || appContext.user.email || DEFAULT_BTP_USER;

    if (headerOverride) {
        return { sapUser: headerOverride.toUpperCase(), isImpersonated: true };
    }
    if (envDefault) {
        return { sapUser: envDefault.trim().toUpperCase(), isImpersonated: true };
    }

    return { sapUser: defaultUser.toUpperCase(), isImpersonated: false };
}
