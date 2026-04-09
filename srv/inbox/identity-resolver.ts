import { Request as ExpressRequest } from 'express';
import { InboxIdentity } from '../types';

/**
 * Identity Resolver
 *
 * Phase 1 (Dev/Demo): Manual SAP user override via request header or env.
 * Phase 2 (Production): BTP Principal Propagation → auto-maps BTP user to SAP user.
 *
 * Resolution priority:
 *   1. `x-sap-user` header (explicit override — dev only)
 *   2. `SAP_DEFAULT_USER` env var (fallback for local dev)
 *   3. Authenticated BTP user (production path)
 */

const DEFAULT_SAP_USER = 'DEMO_USER';
const DEFAULT_BTP_USER = 'anonymous';

export function resolveIdentity(req: ExpressRequest): InboxIdentity {
    // 1. Extract BTP user from auth context (mocked or real XSUAA)
    const btpUser = extractBtpUser(req);
    const userJwt = extractUserJwt(req);

    // 2. Resolve SAP user with override chain
    const headerOverride = req.headers['x-sap-user'] as string | undefined;
    const envDefault = process.env.SAP_DEFAULT_USER || process.env.SAP_TASK_HARDCODED_USER;

    let sapUser: string;
    let isImpersonated: boolean;

    if (headerOverride) {
        sapUser = headerOverride.toUpperCase();
        isImpersonated = true;
    } else if (envDefault) {
        sapUser = envDefault.toUpperCase();
        isImpersonated = true;
    } else {
        // Phase 2: derive SAP user from BTP user via principal propagation
        sapUser = btpUser.toUpperCase();
        isImpersonated = false;
    }

    return { btpUser, sapUser, isImpersonated, userJwt };
}

/**
 * Extract BTP user from request auth context.
 * Works with both mocked auth and real XSUAA tokens.
 */
function extractBtpUser(req: ExpressRequest): string {
    // CAP sets req.user when auth is configured
    const user = (req as unknown as Record<string, unknown>).user as
        | { id?: string; attr?: { email?: string } }
        | undefined;

    if (user?.id) return user.id;
    if (user?.attr?.email) return user.attr.email;

    // Fallback: check authorization header for basic auth
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Basic ')) {
        try {
            const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
            const [username] = decoded.split(':');
            if (username) return username;
        } catch {
            // ignore decode failures
        }
    }

    return DEFAULT_BTP_USER;
}

function extractUserJwt(req: ExpressRequest): string | undefined {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        if (token) return token;
    }

    const approuterAuth = req.headers['x-approuter-authorization'];
    if (typeof approuterAuth === 'string' && approuterAuth.startsWith('Bearer ')) {
        const token = approuterAuth.slice(7).trim();
        if (token) return token;
    }
    if (Array.isArray(approuterAuth)) {
        const bearer = approuterAuth.find((v) => typeof v === 'string' && v.startsWith('Bearer '));
        if (bearer) {
            const token = bearer.slice(7).trim();
            if (token) return token;
        }
    }

    const forwardedToken = req.headers['x-forwarded-access-token'];
    if (typeof forwardedToken === 'string' && forwardedToken.trim()) {
        return forwardedToken.trim();
    }
    if (Array.isArray(forwardedToken) && forwardedToken[0]?.trim()) {
        return forwardedToken[0].trim();
    }

    const xUserToken = req.headers['x-user-token'];
    if (typeof xUserToken === 'string' && xUserToken.trim()) {
        return xUserToken.trim();
    }
    if (Array.isArray(xUserToken) && xUserToken[0]?.trim()) {
        return xUserToken[0].trim();
    }

    const user = (req as unknown as Record<string, unknown>).user as
        | {
              jwt?: unknown;
              _jwt?: unknown;
              tokenInfo?: { getTokenValue?: () => string };
          }
        | undefined;

    const tokenFromTokenInfo = user?.tokenInfo?.getTokenValue?.();
    if (tokenFromTokenInfo?.trim()) {
        return tokenFromTokenInfo.trim();
    }

    if (typeof user?.jwt === 'string' && user.jwt.trim()) {
        return user.jwt.trim();
    }
    if (typeof user?._jwt === 'string' && user._jwt.trim()) {
        return user._jwt.trim();
    }

    return undefined;
}

/**
 * Validate that identity has a usable SAP user.
 * Throws if SAP user is empty or equals default placeholder.
 */
export function assertSapUser(identity: InboxIdentity): void {
    // In mock mode, we don't need a real SAP user
    if (process.env.USE_MOCK_SAP === 'true') {
        return;
    }

    const normalizedSapUser = identity.sapUser?.trim().toUpperCase();
    const fallbackUsers = new Set([
        DEFAULT_SAP_USER,
        DEFAULT_BTP_USER.toUpperCase(),
    ]);

    if (!normalizedSapUser || fallbackUsers.has(normalizedSapUser)) {
        throw new Error(
            `No SAP user resolved. Set x-sap-user header or SAP_DEFAULT_USER env variable, ` +
            `or verify principal propagation user mapping in Cloud Connector. ` +
            `BTP user: ${identity.btpUser}`
        );
    }
}
