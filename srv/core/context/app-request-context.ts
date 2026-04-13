import { Request as ExpressRequest } from 'express';
import { randomUUID } from 'crypto';

export type TokenSource =
    | 'authorization'
    | 'x-approuter-authorization'
    | 'x-forwarded-access-token'
    | 'x-user-token'
    | 'user.tokenInfo'
    | 'user.jwt'
    | 'user._jwt'
    | 'none';

export interface AppRequestContext {
    requestId: string;
    operationName: string;
    method: string;
    path: string;
    isAuthenticated: boolean;
    user: {
        id?: string;
        email?: string;
        roles: string[];
        sapUserOverride?: string;
    };
    auth: {
        tokenSource: TokenSource;
        hasUserJwt: boolean;
        userJwt?: string;
    };
}

interface RequestUserShape {
    id?: string;
    attr?: {
        email?: string;
        scope?: string[];
        scopes?: string[];
        xs_system?: {
            attributes?: {
                xs_rolecollections?: string[];
            };
        };
    };
    roles?: string[] | Record<string, boolean>;
    tokenInfo?: {
        getTokenValue?: () => string;
    };
    jwt?: unknown;
    _jwt?: unknown;
}

const REQUEST_ID_HEADERS = ['x-request-id', 'x-correlation-id'] as const;

export function buildAppRequestContext(
    req: ExpressRequest,
    operationName: string
): AppRequestContext {
    const user = readUser(req);
    const requestId = resolveRequestId(req);
    const userJwt = extractUserJwtFromRequest(req, user);

    return {
        requestId,
        operationName,
        method: req.method,
        path: req.path,
        isAuthenticated: Boolean(user.id || user.email),
        user: {
            id: user.id,
            email: user.email,
            roles: user.roles,
            sapUserOverride: readHeaderValue(req, 'x-sap-user')?.toUpperCase(),
        },
        auth: {
            tokenSource: userJwt.source,
            hasUserJwt: Boolean(userJwt.token),
            userJwt: userJwt.token,
        },
    };
}

export function extractUserJwtFromRequest(
    req: ExpressRequest,
    existingUser?: RequestUserShape
): { token?: string; source: TokenSource } {
    const auth = readHeaderValue(req, 'authorization');
    if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        if (token) return { token, source: 'authorization' };
    }

    const approuterAuth = readHeaderValue(req, 'x-approuter-authorization');
    if (approuterAuth?.startsWith('Bearer ')) {
        const token = approuterAuth.slice(7).trim();
        if (token) return { token, source: 'x-approuter-authorization' };
    }

    const forwardedToken = readHeaderValue(req, 'x-forwarded-access-token');
    if (forwardedToken?.trim()) {
        return { token: forwardedToken.trim(), source: 'x-forwarded-access-token' };
    }

    const xUserToken = readHeaderValue(req, 'x-user-token');
    if (xUserToken?.trim()) {
        return { token: xUserToken.trim(), source: 'x-user-token' };
    }

    const user = existingUser || readRawUser(req);
    const tokenFromTokenInfo = user.tokenInfo?.getTokenValue?.();
    if (tokenFromTokenInfo?.trim()) {
        return { token: tokenFromTokenInfo.trim(), source: 'user.tokenInfo' };
    }

    if (typeof user.jwt === 'string' && user.jwt.trim()) {
        return { token: user.jwt.trim(), source: 'user.jwt' };
    }
    if (typeof user._jwt === 'string' && user._jwt.trim()) {
        return { token: user._jwt.trim(), source: 'user._jwt' };
    }

    return { source: 'none' };
}

function resolveRequestId(req: ExpressRequest): string {
    for (const key of REQUEST_ID_HEADERS) {
        const value = readHeaderValue(req, key);
        if (value) return value;
    }
    return randomUUID();
}

function readUser(req: ExpressRequest): {
    id?: string;
    email?: string;
    roles: string[];
} {
    const raw = readRawUser(req);
    const id = readString(raw.id) || readBasicAuthUser(req);
    const email = readString(raw.attr?.email);
    const roles = extractRoles(raw);

    return { id, email, roles };
}

function readRawUser(req: ExpressRequest): RequestUserShape {
    return ((req as unknown as Record<string, unknown>).user as RequestUserShape | undefined) || {};
}

function extractRoles(user: RequestUserShape): string[] {
    const roleSet = new Set<string>();

    const directRoles = user.roles;
    if (Array.isArray(directRoles)) {
        for (const role of directRoles) {
            if (typeof role === 'string' && role.trim()) roleSet.add(role.trim());
        }
    } else if (directRoles && typeof directRoles === 'object') {
        for (const [key, value] of Object.entries(directRoles)) {
            if (value) roleSet.add(key);
        }
    }

    for (const scope of user.attr?.scope || []) {
        if (scope?.trim()) roleSet.add(scope.trim());
    }
    for (const scope of user.attr?.scopes || []) {
        if (scope?.trim()) roleSet.add(scope.trim());
    }
    for (const rc of user.attr?.xs_system?.attributes?.xs_rolecollections || []) {
        if (rc?.trim()) roleSet.add(rc.trim());
    }

    return Array.from(roleSet);
}

function readBasicAuthUser(req: ExpressRequest): string | undefined {
    const authHeader = readHeaderValue(req, 'authorization');
    if (!authHeader?.startsWith('Basic ')) return undefined;

    try {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
        const [username] = decoded.split(':');
        return readString(username);
    } catch {
        return undefined;
    }
}

function readHeaderValue(req: ExpressRequest, key: string): string | undefined {
    const value = req.headers[key];
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        const first = value.find((v) => typeof v === 'string' && v.trim().length > 0);
        return first?.trim();
    }
    return undefined;
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
