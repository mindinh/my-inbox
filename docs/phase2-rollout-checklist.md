# Phase 2 — Rollout Checklist

> Deliverable for Workstreams A and L: Rollout verification and regression checklist.

---

## Pre-Deployment Verification

### TypeScript Compilation
- [ ] `npx tsc --noEmit` passes with zero errors

### Automated Tests
- [ ] `npx vitest run` — all tests pass
  - [ ] task-mapper.test.ts — 32 tests (mapping purity)
  - [ ] task-error-mapper.test.ts — 18 tests (error classification)
  - [ ] task-transport-utils.test.ts — 12 tests (shared helpers)

---

## Smoke Test Checklist

### Task List
- [ ] Task list loads successfully
- [ ] Task counts and key fields match baseline
- [ ] Pagination ($top/$skip) works as before
- [ ] Logs show `task.query.fetchTasks.started/finished` events

### Approved Task List
- [ ] Approved tasks tab loads successfully
- [ ] Logs show `task.query.fetchApprovedTasks.started/finished` events

### Task Detail
- [ ] Full detail loads with all tabs (description, custom attributes, comments, logs, attachments)
- [ ] Custom attribute labels are enriched from definitions
- [ ] Business context (PR/PO) is resolved correctly
- [ ] Logs show `task.detail.fetchTaskDetailBundle.started/finished` events

### Task Information (Fast Render)
- [ ] Lightweight information loads for first render
- [ ] Decision options display correctly
- [ ] Logs show `task.detail.fetchTaskInformation.started/finished` events

### Approve
- [ ] Approve action succeeds on a valid task
- [ ] Comment is attached if provided
- [ ] Logs show `task.decision.executeDecision.started/finished` events
- [ ] Response contract unchanged: `{ success: true, message: "..." }`

### Reject
- [ ] Reject action succeeds on a valid task
- [ ] Mandatory comment validation works
- [ ] Logs show `task.decision.executeDecision.started/finished` events
- [ ] Response contract unchanged

### Forward
- [ ] Forward action succeeds
- [ ] Logs show `task.decision.forwardTask.started/finished` events

### Comments
- [ ] Add comment succeeds
- [ ] PR-specific comment routing still works (dual write)
- [ ] Logs show `task.decision.addComment.started/finished` events

### Attachments
- [ ] Upload attachment succeeds
- [ ] Download/stream attachment works
- [ ] File size guard (10MB) enforced
- [ ] MIME type inference works for common extensions
- [ ] Duplicate extension cleanup works (e.g., `.xlsx.xlsx` → `.xlsx`)

### Error Paths
- [ ] 401 → AUTH_ERROR → logged with `task.error.normalized`
- [ ] 404 → NOT_FOUND → logged correctly
- [ ] SAP business error → SAP_BUSINESS_ERROR → logged correctly
- [ ] No raw SAP error structures leak to frontend

---

## Regression Confidence

- [ ] No controller-layer code contains direct SAP transport details
- [ ] InboxService reads like use-case orchestration
- [ ] Business logic (context resolution, enrichment) stays in service layer
- [ ] All adapter operations produce structured logs
- [ ] Frontend contract is completely unchanged (verify with live UI)

---

## Rollback Triggers

If any of the following occur, rollback the Phase 2 changes:

1. Task list fails to load
2. Approve/reject behavior changes
3. Response payload differs from baseline
4. Error debugging becomes harder (fragmented/noisy logs)
5. Critical SAP request path regression

### Rollback Method
- Revert extracted modules to inline implementation
- Preserve domain models, tests, and docs for future retry
