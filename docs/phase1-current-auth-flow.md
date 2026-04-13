# Phase 1 Current Auth Flow (Baseline)

## Inbound routes
- `GET /api/inbox/tasks`
- `GET /api/inbox/tasks/approved`
- `GET /api/inbox/tasks/:id`
- `GET /api/inbox/tasks/:id/workflow-approval-tree`
- `POST /api/inbox/tasks/:id/decision`
- `POST /api/inbox/tasks/:id/claim`
- `POST /api/inbox/tasks/:id/release`
- `POST /api/inbox/tasks/:id/forward`

## Middleware chain
1. `srv/server.ts` bootstraps `/api/inbox`.
2. If XSUAA mode is active, Passport JWT middleware validates token.
3. JSON body parser runs for inbox routes.
4. Router handlers delegate to `InboxService`.

## Previous auth/user resolution behavior
- Identity resolution was route-level (`resolveIdentity(req)`).
- SAP user was derived from:
  - `x-sap-user` header override, else
  - `SAP_DEFAULT_USER` / `SAP_TASK_HARDCODED_USER`, else
  - `req.user.id` fallback.
- JWT extraction logic appeared in multiple places:
  - `identity-resolver.ts`
  - debug endpoints in `inbox-router.ts`
  - router troubleshooting helpers

## Outbound SAP call behavior
- SAP task operations are executed by `SapTaskClient`.
- Destination or base URL mode is decided from env variables.
- Principal propagation depends on passing `userJwt` into destination calls.
- Decision writes (`approve/reject`) went through `InboxService` + `DecisionHandler` but without a dedicated technical boundary wrapper.

## CSRF behavior
- CSRF fetch and POST handling are implemented in `SapTaskClient`.
- Decision and write calls fetch CSRF per request and attach cookie/token.

## Correlation and observability baseline
- Logs existed but were mostly ad hoc strings.
- Request correlation ID was not normalized across handlers.
- Auth mode and destination intent were not consistently logged in one format.

## Risk points identified
- Manual JWT/header parsing spread across modules.
- Auth-mode assumptions inferred in many places.
- Debugging propagation failures required checking multiple files/log styles.
- Write-flow logging for approve/reject lacked one centralized boundary.
