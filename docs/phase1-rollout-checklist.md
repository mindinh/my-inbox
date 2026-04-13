# Phase 1 Rollout Checklist

## Pre-deploy checks
- `npx tsc --noEmit` passes.
- Inbox service starts without runtime import/config errors.
- Startup log includes:
  - `authMode`
  - `destinationName`
  - `propagationExpected`

## Smoke tests
1. `GET /api/inbox/tasks`
2. `GET /api/inbox/tasks/approved`
3. `GET /api/inbox/tasks/:id`
4. `POST /api/inbox/tasks/:id/decision` with approve key
5. `POST /api/inbox/tasks/:id/decision` with reject key

For each call verify:
- response contract unchanged
- no frontend payload adaptation required
- request log includes `requestId` and `operationName`
- SAP log includes `authMode`, `destinationName`, status, and latency

## Error-path checks
- trigger invalid task id
- trigger SAP connectivity/auth error
- verify logs contain safe summaries only (no token/cookie/csrf leakage)

## Rollback triggers
- task list no longer returns expected data
- approve/reject regressions on known valid tasks
- propagation behavior differs from baseline
- frequent 401/403 without clear mapping root cause

## Rollback actions
1. Revert router-to-context wiring for impacted endpoint(s).
2. Revert decision boundary wrapper if write path regresses.
3. Keep docs and baseline analysis for follow-up iteration.
