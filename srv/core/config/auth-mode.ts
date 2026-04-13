export type AuthMode = 'mock' | 'technical-user' | 'principal-propagation';

export interface AuthRuntimeConfig {
    authMode: AuthMode;
    destinationName: string;
    propagationExpected: boolean;
    useDestination: boolean;
    serviceName: string;
    environment: string;
}

const AUTH_MODE_ENV = 'SAP_AUTH_MODE';
const DEFAULT_DESTINATION = 'SAP_ABAP_BACKEND';

export function resolveAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
    const useDestination = env.SAP_USE_DESTINATION !== 'false';
    const destinationName = env.SAP_TASK_DESTINATION || DEFAULT_DESTINATION;
    const authMode = resolveAuthMode(env, useDestination);

    return {
        authMode,
        destinationName,
        propagationExpected: authMode === 'principal-propagation',
        useDestination,
        serviceName: env.SERVICE_NAME || 'cnma-vj-my-inbox',
        environment: env.NODE_ENV || 'development',
    };
}

export function isValidAuthMode(value: string | undefined): value is AuthMode {
    return value === 'mock' || value === 'technical-user' || value === 'principal-propagation';
}

function resolveAuthMode(env: NodeJS.ProcessEnv, useDestination: boolean): AuthMode {
    const forced = env[AUTH_MODE_ENV]?.trim();
    if (forced && isValidAuthMode(forced)) {
        return forced;
    }

    if (env.USE_MOCK_SAP === 'true') {
        return 'mock';
    }

    if (!useDestination) {
        return 'technical-user';
    }

    const hasTechnicalUser = Boolean(env.SAP_TASK_USER && env.SAP_TASK_PASSWORD);
    if (hasTechnicalUser) {
        return 'technical-user';
    }

    return 'principal-propagation';
}
