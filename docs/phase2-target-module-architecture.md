# Phase 2 — Target Module Architecture

> Deliverable for Workstream A: Inventory and Slice the Existing Task Client by Capability

---

## 1. Capability Inventory

The following table maps each capability from the original monolithic `SapTaskClient` + `InboxService` to its Phase 2 target module.

| Capability | Type | Original Location | Target Module | Priority |
|---|---|---|---|---|
| Task list retrieval | Read/Query | `SapTaskClient.fetchTasks()` | `task-query-adapter.ts` | High |
| Approved task list retrieval | Read/Query | `SapTaskClient.fetchApprovedTasks()` | `task-query-adapter.ts` | High |
| Task detail (full bundle) | Read/Query | `SapTaskClient.fetchTaskDetailBundle()` | `task-detail-adapter.ts` | High |
| Task information (lightweight) | Read/Query | `SapTaskClient.fetchTaskDetail()` + parallel sub-requests | `task-detail-adapter.ts` | High |
| Attachment streaming | Read/Query | `SapTaskClient.fetchAttachmentContent()` | `task-detail-adapter.ts` | Medium |
| Custom attr definition resolution | Read/Query | Inline in `InboxService.getTaskDetail()` | `task-detail-adapter.ts` | Medium |
| Approve / Reject execution | Write/Decision | `DecisionHandler.execute()` | `task-decision-adapter.ts` | High |
| Forward task | Write/Decision | `DecisionHandler.forward()` | `task-decision-adapter.ts` | Medium |
| Add comment | Write/Decision | `SapTaskClient.addComment()` | `task-decision-adapter.ts` | Medium |
| Upload attachment | Write/Decision | `SapTaskClient.addAttachment()` | `task-decision-adapter.ts` | Medium |
| SAP response normalization | Mapping | `task-adapter.ts` (314 lines) | `task-mapper.ts` | High |
| Error classification | Error Handling | Ad-hoc across services | `task-error-mapper.ts` | High |
| OData escaping / URI decode | Transport | Duplicated across files | `task-transport-utils.ts` | Low |
| CSRF token handling | Transport | `SapTaskClient` internal | `SapTaskClient` (unchanged) | — |
| Endpoint/URL construction | Transport | `SapTaskClient` internal | `SapTaskClient` (unchanged) | — |
| Response assembly | Mapping | Inline in `InboxService` | `task-response-assembler.ts` | Medium |

---

## 2. Target Architecture

```
Controller / Route Layer (inbox-router.ts)
  → builds request context, validates inputs
  → calls InboxService

Business Service Layer (inbox-service.ts)
  → orchestrates getTasks / getTaskDetail / approve / reject
  → uses internal DTOs/models
  → calls SAP adapter modules
  → assembles external responses via task-response-assembler

SAP Adapter Layer (srv/integrations/sap/)
  → task-query-adapter    — fetchTasks, fetchApprovedTasks
  → task-detail-adapter   — fetchTaskDetailBundle, fetchTaskInformation, streamAttachmentContent
  → task-decision-adapter — executeDecision, forwardTask, addComment, addAttachment
  → All adapters wrap ISapTaskClient (transport unchanged)

Mapping Layer (srv/integrations/sap/)
  → task-mapper           — raw SAP → internal models (pure, deterministic)
  → task-response-assembler — internal models → existing API response shape

Error Layer
  → task-error-mapper     — transport/SAP/domain errors → InboxErrorCategory
  → inbox-error.types     — InboxError class, category enum

Domain Layer (srv/domain/inbox/)
  → inbox-task.models     — TaskDetailBundle, TaskQueryResult, SAPTaskIdentifiers, etc.
  → inbox-task.dto        — ExecuteDecisionInput, ForwardTaskInput, etc.
  → inbox-error.types     — InboxErrorCategory, InboxError

Shared Transport (srv/integrations/sap/)
  → task-transport-utils  — AdapterContext, OData helpers, module-aware logging
```

---

## 3. Dependency Flow

```
inbox-router → inbox-service → adapters → ISapTaskClient → SAP OData
                             → task-response-assembler
                             → business-context-resolver
                adapters → task-mapper
                adapters → task-error-mapper
                adapters → task-transport-utils (logging, helpers)
```

No circular dependencies. Each layer only depends downward.

---

## 4. Migration Notes

- **`SapTaskClient` is preserved** — Phase 2 wraps it via adapters rather than rewriting HTTP/CSRF logic.
- **`task-adapter.ts`** is now a re-export bridge to `task-mapper.ts` for backward compatibility.
- **`DecisionHandler`** is preserved and consumed by `task-decision-adapter.ts`.
- **Business logic** (context resolution, enrichment, PR comment routing, MIME inference, size guards) remains in `InboxService`.
