# Phase 1 Migration Plan

## Scope of migrated paths
- `GET /tasks`
- `GET /tasks/approved`
- `GET /tasks/:id`
- `GET /tasks/:id/workflow-approval-tree`
- `POST /tasks/:id/decision`

These paths now build and use:
- `AppRequestContext`
- `SAPExecutionContext`

## New modules introduced
- `srv/core/config/auth-mode.ts`
- `srv/core/context/app-request-context.ts`
- `srv/core/context/sap-execution-context.ts`
- `srv/core/logging/request-log.ts`
- `srv/core/logging/sap-call-log.ts`
- `srv/integrations/sap/task-decision-boundary.ts`

## Auth helper inventory and replacement map
- `resolveIdentity(req)` in `identity-resolver.ts`
  - status: retained for compatibility and debug paths
  - replacement for mainline: `buildAppRequestContext` + `buildSAPExecutionContext` + `resolveIdentityFromContexts`

- `assertSapUser(identity)` in `identity-resolver.ts`
  - status: retained for compatibility
  - replacement for mainline: `assertSapUserForExecutionContext`

- direct route-level JWT/header parsing in business path
  - status: replaced for mainline routes by `AppRequestContext` builder
  - debug endpoints keep explicit parsing for diagnostics

## Decision flow migration
- previous: service directly orchestrated decision write execution
- now: service decision execution is wrapped by `executeTaskDecisionBoundary`
- business behavior preserved, logging standardized

## Intentionally not changed in Phase 1
- frontend API contracts
- route names and payload shapes
- SAP transport client architecture
- attachment/media protocols
- CAP service contract surface

## Compatibility strategy
- keep old resolver functions for non-migrated/debug paths
- migrate mainline first
- avoid big-bang deletion in this phase
