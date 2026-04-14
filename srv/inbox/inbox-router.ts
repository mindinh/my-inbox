import express, { Router, Request, Response, NextFunction } from 'express';
import { resolveIdentity } from './resolvers/identity-resolver';
import { getInboxService } from './inbox-service';
import { DecisionError } from './handlers/decision-handler';
import { DecisionRequest, ForwardRequest, InboxIdentity } from '../types';
import { resolveAuthRuntimeConfig } from '../core/config/auth-mode';
import { buildAppRequestContext, AppRequestContext } from '../core/context/app-request-context';
import {
    buildSAPExecutionContext,
    SAPExecutionContext,
} from '../core/context/sap-execution-context';
import { logRequestContextBuilt, logRequestReceived } from '../core/logging/request-log';
import { logSapExecutionContextBuilt } from '../core/logging/sap-call-log';
import {
    assertSapUserForExecutionContext,
    resolveIdentityFromContexts,
} from './helpers/request-context-identity';

const authRuntimeConfig = resolveAuthRuntimeConfig();

/**
 * Inbox Router — REST API endpoints
 *
 * Mounts at /api/inbox and provides:
 *   GET  /tasks          — List all tasks
 *   GET  /tasks/:id      — Task detail
 *   POST /tasks/:id/decision — Execute decision
 *   POST /tasks/:id/forward  — Forward task
 *
 * Each endpoint:
 *   1. Resolves identity (BTP → SAP user)
 *   2. Delegates to InboxService
 *   3. Returns normalized JSON
 */

export function createInboxRouter(): Router {
    const router = Router();

    // GET /debug/current-user
    router.get('/debug/current-user', asyncHandler(async (req: Request, res: Response) => {
        const identity = resolveIdentity(req);
        const jwtInfo = extractJwtFromRequest(req);
        const payload = jwtInfo.token ? decodeJwtPayload(jwtInfo.token) : undefined;

        res.json({
            id: identity.btpUser,
            sapUser: identity.sapUser,
            isImpersonated: identity.isImpersonated,
            hasJwt: Boolean(jwtInfo.token),
            tokenSource: jwtInfo.source,
            jwt: jwtInfo.token || null,
            claims: payload ? summarizeJwtClaims(payload) : null,
        });
    }));

    // GET /debug/jwt
    router.get('/debug/jwt', asyncHandler(async (req: Request, res: Response) => {
        const jwtInfo = extractJwtFromRequest(req);
        if (!jwtInfo.token) {
            res.status(400).json({
                error: 'No JWT found',
                hint: 'Expected Authorization, x-approuter-authorization, x-forwarded-access-token, or x-user-token',
            });
            return;
        }

        const payload = decodeJwtPayload(jwtInfo.token);
        if (!payload) {
            res.status(400).json({
                error: 'JWT payload decode failed',
                tokenSource: jwtInfo.source,
            });
            return;
        }

        res.json({
            tokenSource: jwtInfo.source,
            token: jwtInfo.token,
            tokenPreview: redactToken(jwtInfo.token),
            claims: summarizeJwtClaims(payload),
            rawPayload: payload,
        });
    }));

    // ─── GET /me — Current user display info ─────────────────
    router.get('/me', asyncHandler(async (req: Request, res: Response) => {
        const identity = resolveIdentity(req);
        const jwtInfo = extractJwtFromRequest(req);
        const payload = jwtInfo.token ? decodeJwtPayload(jwtInfo.token) : undefined;

        let displayName: string | undefined;
        let email: string | undefined;
        let firstName: string | undefined;
        let lastName: string | undefined;

        if (payload) {
            firstName = readStringClaim(payload, 'given_name');
            lastName = readStringClaim(payload, 'family_name');
            email = readStringClaim(payload, 'email');
            const userName = readStringClaim(payload, 'user_name');

            if (firstName && lastName) {
                displayName = `${firstName} ${lastName}`;
            } else if (firstName) {
                displayName = firstName;
            } else if (userName) {
                displayName = userName;
            } else if (email) {
                // Use the part before @ as a fallback display name
                displayName = email.split('@')[0];
            }
        }

        res.json({
            id: identity.btpUser,
            sapUser: identity.sapUser,
            displayName: displayName || identity.btpUser || 'User',
            firstName,
            lastName,
            email: email || identity.btpUser,
        });
    }));

    // ─── GET /dashboard ───────────────────────────────────────
    router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'getDashboard');
        const service = getInboxService();
        const result = await service.getDashboard(identity, { appContext, sapContext });
        res.json(result);
    }));

    // ─── GET /tasks ───────────────────────────────────────
    router.get('/tasks', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'getTasks');
        const service = getInboxService();
        const top = req.query.top ? parseInt(req.query.top as string, 10) : undefined;
        const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : undefined;
        const result = await service.getTasks(identity, { top, skip }, { appContext, sapContext });
        res.json(result);
    }));

    // ─── GET /tasks/approved ──────────────────────────────
    router.get('/tasks/approved', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'getApprovedTasks');
        const service = getInboxService();
        const top = req.query.top ? parseInt(req.query.top as string, 10) : undefined;
        const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : undefined;
        const result = await service.getApprovedTasks(identity, { top, skip }, { appContext, sapContext });
        res.json(result);
    }));

    // ─── GET /tasks/:id/overview (fast-path, 3-segment batch) ─────
    router.get('/tasks/:id/overview', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'getTaskOverview');
        const service = getInboxService();
        const id = req.params.id as string;

        const clientHints = {
            sapOrigin: req.query.sapOrigin as string | undefined,
            documentId: req.query.documentId as string | undefined,
            businessObjectType: req.query.businessObjectType as string | undefined,
        };
        const hasHints = clientHints.sapOrigin || clientHints.documentId;

        const result = await service.getTaskOverview(
            identity, id, { appContext, sapContext },
            hasHints ? clientHints : undefined
        );
        res.json(result);
    }));

    // ─── GET /tasks/:id/information (backward-compat, 5-segment batch) ─────
    router.get('/tasks/:id/information', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'getTaskInformation');
        const service = getInboxService();
        const id = req.params.id as string;

        // Accept optional client hints to skip redundant SAP lookups
        const clientHints = {
            sapOrigin: req.query.sapOrigin as string | undefined,
            documentId: req.query.documentId as string | undefined,
            businessObjectType: req.query.businessObjectType as string | undefined,
        };
        const hasHints = clientHints.sapOrigin || clientHints.documentId;

        const result = await service.getTaskInformation(
            identity, id, { appContext, sapContext },
            hasHints ? clientHints : undefined
        );
        res.json(result);
    }));

    router.get('/tasks/:id', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'getTaskDetail');
        const service = getInboxService();
        const id = req.params.id as string;

        const result = await service.getTaskDetail(identity, id, { appContext, sapContext });
        res.json(result);
    }));

    // ─── GET /tasks/:id/workflow-approval-tree ────────
    router.get('/tasks/:id/workflow-approval-tree', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'getPurchaseRequisitionApprovalTree');
        const service = getInboxService();
        const id = req.params.id as string;
        const documentId = req.query.documentId as string | undefined;
        const sapOrigin = req.query.sapOrigin as string | undefined;

        const result = await service.getPurchaseRequisitionApprovalTree(identity, id, documentId, sapOrigin, {
            appContext,
            sapContext,
        });
        res.json(result);
    }));

    // ─── POST /tasks/:id/decision ─────────────────────────
    router.post('/tasks/:id/decision', asyncHandler(async (req: Request, res: Response) => {
        const { identity, appContext, sapContext } = buildInboxRequestContext(req, 'executeDecision');
        const service = getInboxService();
        const id = req.params.id as string;

        const request: DecisionRequest = {
            decisionKey: req.body.decisionKey,
            comment: req.body.comment,
            reasonCode: req.body.reasonCode,
            type: req.body.type,
            _context: req.body._context,
        };

        const result = await service.executeDecision(identity, id, request, { appContext, sapContext });
        res.json(result);
    }));

    // ─── POST /tasks/:id/forward ──────────────────────────
    router.post('/tasks/:id/forward', asyncHandler(async (req: Request, res: Response) => {
        const identity = resolveAndValidateIdentity(req);
        const service = getInboxService();
        const id = req.params.id as string;

        const request: ForwardRequest = {
            forwardTo: req.body.forwardTo,
            comment: req.body.comment,
        };

        const result = await service.forwardTask(identity, id, request.forwardTo);
        res.json(result);
    }));

    // ─── POST /tasks/:id/comments ──────────────────────────
    router.post('/tasks/:id/comments', asyncHandler(async (req: Request, res: Response) => {
        const identity = resolveAndValidateIdentity(req);
        const service = getInboxService();
        const id = req.params.id as string;
        const { text, _context } = req.body || {};

        if (!text?.trim()) {
            res.status(400).json({ success: false, error: 'Comment text is required.', code: 'VALIDATION_ERROR' });
            return;
        }

        const result = await service.addComment(identity, id, text.trim(), _context);
        res.json(result);
    }));

    // ─── GET /tasks/:id/attachments/:attId/content ────────
    router.get('/tasks/:id/attachments/:attId/content', asyncHandler(async (req: Request, res: Response) => {
        const identity = resolveAndValidateIdentity(req);
        const service = getInboxService();
        const id = req.params.id as string;
        const attId = req.params.attId as string;
        const disposition = (req.query.disposition as string) || 'inline';

        const { data, contentType, fileName } = await service.streamAttachmentContent(identity, id, attId);

        res.setHeader('Content-Type', contentType);
        if (fileName) {
            const dispositionType = disposition === 'attachment' ? 'attachment' : 'inline';
            res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(fileName)}"`);
        }
        res.setHeader('Content-Length', data.byteLength);
        res.send(data);
    }));

    // ─── POST /tasks/:id/attachments (upload) ────────────
    router.post(
        '/tasks/:id/attachments',
        express.raw({ limit: '10mb', type: '*/*' }),
        asyncHandler(async (req: Request, res: Response) => {
            const identity = resolveAndValidateIdentity(req);
            const service = getInboxService();
            const id = req.params.id as string;

            // File name from Slug header (SAP convention)
            const slug = req.headers['slug'] as string | undefined;
            const fileName = slug ? decodeURIComponent(slug) : `upload-${Date.now()}`;
            const mimeType = (req.headers['content-type'] as string) || 'application/octet-stream';
            const sapOrigin = req.headers['x-sap-origin'] as string | undefined;

            const buffer = Buffer.isBuffer(req.body)
                ? req.body
                : Buffer.from(req.body as ArrayBuffer);

            if (!buffer.byteLength) {
                res.status(400).json({
                    success: false,
                    error: 'Empty file body.',
                    code: 'VALIDATION_ERROR',
                });
                return;
            }

            const result = await service.addAttachment(identity, id, fileName, mimeType, buffer, sapOrigin);
            res.json(result);
        })
    );

    // ─── PR Attachment Endpoints (Standalone API) ─────────

    // GET /pr/:docNum/attachments — List PR attachment metadata
    router.get('/pr/:docNum/attachments', asyncHandler(async (req: Request, res: Response) => {
        const identity = resolveAndValidateIdentity(req);
        const service = getInboxService();
        const docNum = req.params.docNum as string;
        const sapOrigin = req.query.sapOrigin as string | undefined;

        const attachments = await service.getPrAttachments(identity, docNum, sapOrigin);
        res.json({ attachments, count: attachments.length });
    }));

    // GET /pr/:docNum/attachments/:attachId/content — Download PR attachment content
    router.get('/pr/:docNum/attachments/:attachId/content', asyncHandler(async (req: Request, res: Response) => {
        const identity = resolveAndValidateIdentity(req);
        const service = getInboxService();
        const docNum = req.params.docNum as string;
        const attachId = decodeURIComponent(req.params.attachId as string);
        const sapOrigin = req.query.sapOrigin as string | undefined;
        const disposition = (req.query.disposition as string) || 'inline';

        const { data, contentType, fileName: resolvedFileName } =
            await service.streamPrAttachmentContent(identity, docNum, attachId, sapOrigin);

        res.setHeader('Content-Type', contentType);
        if (resolvedFileName) {
            const dispositionType = disposition === 'attachment' ? 'attachment' : 'inline';
            res.setHeader(
                'Content-Disposition',
                `${dispositionType}; filename="${resolvedFileName.replace(/"/g, '\\"')}"; filename*=UTF-8''${encodeURIComponent(resolvedFileName)}`
            );
        }
        res.setHeader('Content-Length', data.byteLength);
        res.end(data);
    }));

    // POST /pr/:docNum/attachments — Upload PR attachment
    router.post(
        '/pr/:docNum/attachments',
        express.raw({ limit: '5mb', type: '*/*' }),
        asyncHandler(async (req: Request, res: Response) => {
            const identity = resolveAndValidateIdentity(req);
            const service = getInboxService();
            const docNum = req.params.docNum as string;

            const slug = req.headers['slug'] as string | undefined;
            const fileName = slug ? decodeURIComponent(slug) : `upload-${Date.now()}`;
            const mimeType = (req.headers['content-type'] as string) || 'application/octet-stream';
            const sapOrigin = req.headers['x-sap-origin'] as string | undefined;

            const buffer = Buffer.isBuffer(req.body)
                ? req.body
                : Buffer.from(req.body as ArrayBuffer);

            if (!buffer.byteLength) {
                res.status(400).json({
                    success: false,
                    error: 'Empty file body.',
                    code: 'VALIDATION_ERROR',
                });
                return;
            }

            const result = await service.uploadPrAttachment(
                identity, docNum, fileName, mimeType, buffer, sapOrigin
            );
            res.json(result);
        })
    );

    // ─── Error handler ────────────────────────────────────
    router.use(inboxErrorHandler);

    return router;
}

// ─── Async Handler Wrapper ────────────────────────────────

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

interface InboxRequestContext {
    appContext: AppRequestContext;
    sapContext: SAPExecutionContext;
    identity: InboxIdentity;
}

type ContextAwareRequest = Request & { inboxContext?: InboxRequestContext };

function asyncHandler(fn: AsyncRequestHandler) {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
}

function buildInboxRequestContext(req: Request, operationName: string): InboxRequestContext {
    const appContext = buildAppRequestContext(req, operationName);
    logRequestReceived(req, appContext);
    logRequestContextBuilt(appContext);

    const sapContext = buildSAPExecutionContext(appContext, authRuntimeConfig);
    logSapExecutionContextBuilt(appContext, sapContext);
    assertSapUserForExecutionContext(sapContext);

    const identity = resolveIdentityFromContexts(appContext, sapContext);
    (req as ContextAwareRequest).inboxContext = { appContext, sapContext, identity };
    return { appContext, sapContext, identity };
}

function resolveAndValidateIdentity(req: Request, operationName = 'legacy.route'): InboxIdentity {
    return buildInboxRequestContext(req, operationName).identity;
}

// ─── Error Handler ────────────────────────────────────────

function inboxErrorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    const requestContext = (req as ContextAwareRequest).inboxContext?.appContext;
    if (requestContext) {
        console.error(
            JSON.stringify({
                event: 'request.error',
                requestId: requestContext.requestId,
                operationName: requestContext.operationName,
                method: requestContext.method,
                path: requestContext.path,
                message: err.message,
            })
        );
    }

    console.error('[InboxRouter] Error:', err.message);
    const causeMessage = extractCauseMessage(err);
    if (causeMessage) {
        console.error('[InboxRouter] Root cause:', causeMessage);
    }

    const hasBearer = hasBearerAuthHeader(req);
    const hasApprouterBearer = hasApprouterBearerHeader(req);
    const hasForwardedToken = hasForwardedAccessTokenHeader(req);
    const hasXUserToken = hasXUserTokenHeader(req);
    console.error(
        `[InboxRouter] Auth headers present: bearer=${hasBearer}, approuterBearer=${hasApprouterBearer}, x-forwarded-access-token=${hasForwardedToken}, x-user-token=${hasXUserToken}`
    );

    if (
        err.message.includes('Failed to build headers.') &&
        !hasBearer &&
        !hasApprouterBearer &&
        !hasForwardedToken &&
        !hasXUserToken
    ) {
        console.error(
            '[InboxRouter] Hint: PrincipalPropagation needs a user JWT (Authorization, x-approuter-authorization, x-forwarded-access-token, or x-user-token).'
        );
    }

    const extracted = extractSdkHttpError(err);
    if (extracted) {
        console.error('[InboxRouter] SAP status:', extracted.status);
        if (extracted.body) {
            console.error('[InboxRouter] SAP body:', extracted.body);
        }
        if (extracted.status === 401) {
            logJwtSummaryForTroubleshooting(req);
        }
    }

    if (err instanceof DecisionError) {
        res.status(err.httpStatus).json({
            success: false,
            error: err.message,
            code: err.code,
        });
        return;
    }

    if (isSapUserMappingError(err, extracted)) {
        const message =
            'Cannot map your BTP user to an SAP user in S/4. Please verify Cloud Connector Principal Propagation user mapping.';
        res.status(424).json({
            success: false,
            error: message,
            code: 'SAP_USER_MAPPING_MISSING',
        });
        return;
    }

    // Check for Axios errors (SAP connection failures)
    if (isAxiosError(err)) {
        const errAny = err as unknown as Record<string, unknown>;
        const status = errAny.response
            ? (errAny.response as Record<string, unknown>).status as number
            : 502;
        const body = errAny.response
            ? (errAny.response as Record<string, unknown>).data
            : undefined;
        res.status(status).json({
            success: false,
            error: `SAP communication error: ${err.message}`,
            code: 'SAP_CONNECTIVITY_ERROR',
            details: body,
        });
        return;
    }

    if (extracted) {
        res.status(extracted.status).json({
            success: false,
            error: `SAP communication error: ${err.message}`,
            code: 'SAP_CONNECTIVITY_ERROR',
            details: extracted.body,
        });
        return;
    }

    // Generic error
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
    });
}

function isAxiosError(err: unknown): boolean {
    return !!(err as Record<string, unknown>)?.isAxiosError;
}

function extractSdkHttpError(err: unknown): { status: number; body?: unknown } | null {
    const anyErr = err as Record<string, unknown> | null;
    if (!anyErr) return null;

    const directResponse = anyErr.response as Record<string, unknown> | undefined;
    if (directResponse && typeof directResponse.status === 'number') {
        return { status: directResponse.status as number, body: directResponse.data };
    }

    const cause = anyErr.cause as Record<string, unknown> | undefined;
    const causeResponse = cause?.response as Record<string, unknown> | undefined;
    if (causeResponse && typeof causeResponse.status === 'number') {
        return { status: causeResponse.status as number, body: causeResponse.data };
    }

    return null;
}

function extractCauseMessage(err: unknown): string | undefined {
    const anyErr = err as Record<string, unknown> | null;
    if (!anyErr) return undefined;
    const cause = anyErr.cause as Record<string, unknown> | undefined;
    if (!cause) return undefined;
    const message = cause.message;
    return typeof message === 'string' ? message : undefined;
}

function logJwtSummaryForTroubleshooting(req: Request): void {
    const jwtInfo = extractJwtFromRequest(req);
    if (!jwtInfo.token) {
        console.error('[InboxRouter] JWT summary: no JWT available on request');
        return;
    }

    const payload = decodeJwtPayload(jwtInfo.token);
    if (!payload) {
        console.error(`[InboxRouter] JWT summary: decode failed (source=${jwtInfo.source})`);
        return;
    }

    const summary = summarizeJwtClaims(payload);
    console.error(
        `[InboxRouter] JWT summary: source=${jwtInfo.source}, sub=${toLogValue(summary.sub)}, email=${toLogValue(summary.email)}, user_name=${toLogValue(summary.userName)}, preferred_username=${toLogValue(summary.preferredUsername)}, client_id=${toLogValue(summary.clientId)}, grant_type=${toLogValue(summary.grantType)}, exp=${toLogValue(summary.expiresAt)}`
    );
}

function toLogValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function extractJwtFromRequest(req: Request): { token?: string; source: string } {
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        const token = auth.slice(7).trim();
        if (token) return { token, source: 'authorization' };
    }

    const approuterAuth = req.headers['x-approuter-authorization'];
    if (typeof approuterAuth === 'string' && approuterAuth.startsWith('Bearer ')) {
        const token = approuterAuth.slice(7).trim();
        if (token) return { token, source: 'x-approuter-authorization' };
    }
    if (Array.isArray(approuterAuth)) {
        const found = approuterAuth.find((v) => typeof v === 'string' && v.startsWith('Bearer '));
        if (found) {
            const token = found.slice(7).trim();
            if (token) return { token, source: 'x-approuter-authorization' };
        }
    }

    const forwarded = req.headers['x-forwarded-access-token'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return { token: forwarded.trim(), source: 'x-forwarded-access-token' };
    }
    if (Array.isArray(forwarded)) {
        const token = forwarded.find((v) => typeof v === 'string' && v.trim())?.trim();
        if (token) return { token, source: 'x-forwarded-access-token' };
    }

    const xUserToken = req.headers['x-user-token'];
    if (typeof xUserToken === 'string' && xUserToken.trim()) {
        return { token: xUserToken.trim(), source: 'x-user-token' };
    }
    if (Array.isArray(xUserToken)) {
        const token = xUserToken.find((v) => typeof v === 'string' && v.trim())?.trim();
        if (token) return { token, source: 'x-user-token' };
    }

    return { source: 'none' };
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
    const parts = token.split('.');
    if (parts.length < 2) return undefined;

    try {
        const base64 = normalizeBase64Url(parts[1]);
        const json = Buffer.from(base64, 'base64').toString('utf8');
        const payload = JSON.parse(json);
        return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;
    } catch {
        return undefined;
    }
}

function normalizeBase64Url(base64Url: string): string {
    const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    return `${padded}${'='.repeat(padLength)}`;
}

function summarizeJwtClaims(payload: Record<string, unknown>): Record<string, unknown> {
    const exp = readNumericClaim(payload, 'exp');
    const iat = readNumericClaim(payload, 'iat');
    const scope = payload.scope;
    const aud = payload.aud;

    return {
        sub: readStringClaim(payload, 'sub'),
        email: readStringClaim(payload, 'email'),
        userName: readStringClaim(payload, 'user_name'),
        preferredUsername: readStringClaim(payload, 'preferred_username'),
        clientId: readStringClaim(payload, 'client_id') || readStringClaim(payload, 'cid') || readStringClaim(payload, 'azp'),
        grantType: readStringClaim(payload, 'grant_type'),
        zoneId: readStringClaim(payload, 'zid'),
        expiresAt: exp ? new Date(exp * 1000).toISOString() : undefined,
        issuedAt: iat ? new Date(iat * 1000).toISOString() : undefined,
        scope: Array.isArray(scope) ? scope : typeof scope === 'string' ? scope.split(' ') : scope,
        audience: Array.isArray(aud) ? aud : typeof aud === 'string' ? [aud] : undefined,
    };
}

function readStringClaim(payload: Record<string, unknown>, key: string): string | undefined {
    const value = payload[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumericClaim(payload: Record<string, unknown>, key: string): number | undefined {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function redactToken(token: string): string {
    if (token.length <= 24) return token;
    return `${token.slice(0, 12)}...${token.slice(-12)}`;
}

function hasBearerAuthHeader(req: Request): boolean {
    const value = req.headers.authorization;
    return typeof value === 'string' && value.startsWith('Bearer ');
}

function hasXUserTokenHeader(req: Request): boolean {
    const value = req.headers['x-user-token'];
    if (typeof value === 'string') return value.trim().length > 0;
    return Array.isArray(value) && value.some((v) => typeof v === 'string' && v.trim().length > 0);
}

function hasApprouterBearerHeader(req: Request): boolean {
    const value = req.headers['x-approuter-authorization'];
    if (typeof value === 'string') return value.startsWith('Bearer ');
    return Array.isArray(value) && value.some((v) => typeof v === 'string' && v.startsWith('Bearer '));
}

function hasForwardedAccessTokenHeader(req: Request): boolean {
    const value = req.headers['x-forwarded-access-token'];
    if (typeof value === 'string') return value.trim().length > 0;
    return Array.isArray(value) && value.some((v) => typeof v === 'string' && v.trim().length > 0);
}

function isSapUserMappingError(
    err: Error,
    extracted: { status: number; body?: unknown } | null
): boolean {
    const normalizedErrorMessage = (err.message || '').toLowerCase();
    if (normalizedErrorMessage.includes('no sap user resolved')) {
        return true;
    }

    if (!extracted || ![401, 403].includes(extracted.status)) {
        return false;
    }

    const details = `${normalizedErrorMessage} ${extractCauseMessage(err) || ''} ${extractBodyText(extracted.body)}`.toLowerCase();

    const hasUserSignal = details.includes('user');
    const hasMappingSignal =
        details.includes('mapping') ||
        details.includes('mapped') ||
        details.includes('principal propagation') ||
        details.includes('principal') ||
        details.includes('no logon') ||
        details.includes('not exist');

    return hasUserSignal && hasMappingSignal;
}

function extractBodyText(body: unknown): string {
    if (!body) return '';
    if (typeof body === 'string') return body;

    try {
        const asJson = JSON.stringify(body);
        return typeof asJson === 'string' ? asJson : '';
    } catch {
        return '';
    }
}
