import cds from '@sap/cds';
import express from 'express';
import passport from 'passport';
import { createInboxRouter } from './inbox/inbox-router';
import { resolveAuthRuntimeConfig } from './core/config/auth-mode';
import { logStartupAuthContext } from './core/logging/request-log';

/**
 * Custom server configuration
 * Mounts the Inbox REST API alongside CAP's own OData services.
 *
 * Auth strategy:
 *   - Local dev:  cds.requires.auth.kind = 'mocked' → passport not loaded, req.user from basic auth
 *   - Production: cds.requires.auth.kind = 'xsuaa'  → XssecPassportStrategy decodes BTP token → req.user populated
 *
 * This is critical for Principal Propagation: the JWT must be available
 * on req so that identity-resolver can extract it and SAP Cloud SDK can
 * exchange it for an SAP assertion token.
 */
cds.on('bootstrap', (app: express.Application) => {
    const runtimeAuthConfig = resolveAuthRuntimeConfig();
    logStartupAuthContext(runtimeAuthConfig);
    // ─── Auth middleware for custom routes ────────────────────────────
    const authKind = cds.env.requires?.auth?.kind;
    const isMockMode = runtimeAuthConfig.authMode === 'mock';
    const isXsuaa = authKind === 'xsuaa' && !isMockMode;

    if (isMockMode) {
        console.log('[Server] Mock mode active — XSUAA middleware disabled');
    }

    if (isXsuaa) {
        try {
            // @sap/xssec v4+ exports XssecPassportStrategy (not JWTStrategy)
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const xssec = require('@sap/xssec');
            
            // Prefer credentials automatically injected by CAP (via cds bind or environment)
            let xsuaaCredentials = cds.env.requires?.auth?.credentials;
            
            if (!xsuaaCredentials) {
                // Fallback to xsenv reading from VCAP_SERVICES
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const xsenv = require('@sap/xsenv');
                xsenv.loadEnv();
                xsuaaCredentials = xsenv.getServices({ xsuaa: { tag: 'xsuaa' } }).xsuaa;
            }

            if (!xsuaaCredentials) {
                throw new Error("XSUAA credentials not found in environment");
            }

            // xssec v4 requires a service instance (not plain credentials object).
            const ObjectXsuaaService = xssec.XsuaaService || xssec.ODataAuthStrategy; 
            const XssecPassportStrategy = xssec.XssecPassportStrategy;
            const SECURITY_CONTEXT = xssec.SECURITY_CONTEXT;
            
            const authService = new ObjectXsuaaService(xsuaaCredentials);
            passport.use('JWT', new XssecPassportStrategy(authService, SECURITY_CONTEXT));
            app.use(passport.initialize());

            // Work Zone managed approuter may forward user JWT in non-standard headers.
            // Normalize them to Authorization so passport JWT strategy can validate it.
            app.use('/api/inbox', (req: express.Request, _res: express.Response, next: express.NextFunction) => {
                const authHeader = req.headers.authorization;
                const hasBearerAuth =
                    typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

                if (!hasBearerAuth) {
                    const token = extractBearerTokenFromRequest(req);
                    if (token) {
                        req.headers.authorization = `Bearer ${token}`;
                    }
                }
                next();
            });

            // Protect all /api/inbox routes with XSUAA JWT validation
            app.use('/api/inbox', passport.authenticate('JWT', { session: false, failWithError: true }));
            app.use(
                '/api/inbox',
                (
                    err: Error & { status?: number; statusCode?: number },
                    req: express.Request,
                    res: express.Response,
                    next: express.NextFunction
                ) => {
                    if (!err) {
                        return next();
                    }

                    const status = err.statusCode || err.status || 401;
                    console.error('[Server] XSUAA auth error for /api/inbox:', err.message);
                    console.error('[Server] XSUAA auth error type:', err.name);
                    console.error(
                        '[Server] Auth headers present:',
                        `authorization=${hasHeaderValue(req.headers.authorization)}`,
                        `x-approuter-authorization=${hasHeaderValue(req.headers['x-approuter-authorization'])}`,
                        `x-forwarded-authorization=${hasHeaderValue(req.headers['x-forwarded-authorization'])}`,
                        `x-forwarded-access-token=${hasHeaderValue(req.headers['x-forwarded-access-token'])}`,
                        `x-user-token=${hasHeaderValue(req.headers['x-user-token'])}`
                    );
                    return res.status(status).json({ error: 'Unauthorized', message: err.message });
                }
            );

            console.log('[Server] XSUAA middleware enabled for /api/inbox (Principal Propagation ready)');
        } catch (err) {
            console.error('[Server] Failed to initialize XSUAA middleware:', err instanceof Error ? err.message : String(err));
            console.warn('[Server] /api/inbox routes will NOT have req.user — Principal Propagation will fail!');
        }
    } else {
        console.log(`[Server] Auth kind = '${authKind}' — skipping XSUAA middleware (local dev mode)`);
    }

    // Parse JSON bodies for our custom routes
    app.use('/api/inbox', express.json({ limit: '10mb' }));

    // Mount the Inbox REST API
    app.use('/api/inbox', createInboxRouter());

    console.log('[Server] Inbox REST API mounted at /api/inbox');
});

// Export server module
export default cds.server;

function extractBearerTokenFromRequest(req: express.Request): string | undefined {
    const forwardedAuthorization = req.headers['x-forwarded-authorization'];
    if (typeof forwardedAuthorization === 'string' && forwardedAuthorization.startsWith('Bearer ')) {
        return forwardedAuthorization.slice(7).trim();
    }
    if (Array.isArray(forwardedAuthorization)) {
        const bearer = forwardedAuthorization.find(
            (v) => typeof v === 'string' && v.startsWith('Bearer ')
        );
        if (bearer) return bearer.slice(7).trim();
    }

    const approuterAuth = req.headers['x-approuter-authorization'];
    if (typeof approuterAuth === 'string' && approuterAuth.startsWith('Bearer ')) {
        return approuterAuth.slice(7).trim();
    }
    if (Array.isArray(approuterAuth)) {
        const bearer = approuterAuth.find((v) => typeof v === 'string' && v.startsWith('Bearer '));
        if (bearer) return bearer.slice(7).trim();
    }

    const forwardedToken = req.headers['x-forwarded-access-token'];
    if (typeof forwardedToken === 'string' && forwardedToken.trim()) {
        return forwardedToken.trim();
    }
    if (Array.isArray(forwardedToken)) {
        const token = forwardedToken.find((v) => typeof v === 'string' && v.trim());
        if (token) return token.trim();
    }

    const xUserToken = req.headers['x-user-token'];
    if (typeof xUserToken === 'string' && xUserToken.trim()) {
        return xUserToken.trim();
    }
    if (Array.isArray(xUserToken)) {
        const token = xUserToken.find((v) => typeof v === 'string' && v.trim());
        if (token) return token.trim();
    }

    return undefined;
}

function hasHeaderValue(value: string | string[] | undefined): boolean {
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
        return value.some((v) => typeof v === 'string' && v.trim().length > 0);
    }
    return false;
}
