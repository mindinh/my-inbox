# Phase 1 Target Context Model

## Core flow
1. Router builds `AppRequestContext` from inbound request.
2. Router builds `SAPExecutionContext` from request context + centralized auth config.
3. Router validates SAP user from execution context.
4. Service executes business logic with normalized contexts.
5. SAP read/write calls emit standardized structured logs.
6. Decision write path (`/tasks/:id/decision`) runs through shared decision boundary.

## AppRequestContext
`srv/core/context/app-request-context.ts`

Fields used by mainline flows:
- `requestId`
- `operationName`
- `method`, `path`
- `isAuthenticated`
- `user.id`, `user.email`, `user.roles`
- `auth.tokenSource`, `auth.hasUserJwt`, `auth.userJwt`

Purpose:
- normalize request identity once
- avoid raw JWT parsing in business service code

## SAPExecutionContext
`srv/core/context/sap-execution-context.ts`

Fields used by mainline flows:
- `destinationName`
- `authMode` (`mock | technical-user | principal-propagation`)
- `propagationExpected`
- `hasUserContext`
- `sapUser`
- `isImpersonated`

Purpose:
- centralize SAP call intent and auth mode interpretation
- keep SAP/user identity handling out of route-specific logic

## Decision boundary
`srv/integrations/sap/task-decision-boundary.ts`

Purpose:
- one explicit technical wrapper for decision writes
- unified log events for started/finished/failed decision calls
- no change to frontend contract or business semantics

## Logging model
- startup: `app.startup.auth_context`
- request entry: `request.received`
- context build: `request.context.built`, `sap.execution_context.built`
- SAP read: `sap.read.started`, `sap.read.finished`
- SAP decision: `sap.decision.started`, `sap.decision.finished`, `sap.decision.failed`

Sensitive values not logged:
- raw JWT
- authorization header values
- CSRF tokens
- cookies
