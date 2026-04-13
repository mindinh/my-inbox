# Phase 2 — Internal Models Reference

> Deliverable: Domain model and DTO documentation for Phase 2 modularization.

---

## 1. Domain Models (`srv/domain/inbox/inbox-task.models.ts`)

### TaskQueryResult
Returned by the query adapter for task list endpoints.

| Field | Type | Description |
|---|---|---|
| `items` | `InboxTask[]` | Normalized task list |
| `total` | `number` | Total count for pagination |

### TaskDetailBundle
Returned by the detail adapter for full task detail (all tabs).

| Field | Type | Description |
|---|---|---|
| `task` | `InboxTask` | Normalized task header |
| `decisions` | `Decision[]` | Available decision options |
| `description` | `TaskDescription \| undefined` | Task description (HTML or text) |
| `customAttributes` | `CustomAttribute[]` | Sorted custom attributes |
| `taskObjects` | `TaskObject[]` | Linked business objects |
| `comments` | `TaskComment[]` | Task comments |
| `processingLogs` | `ProcessingLog[]` | Processing history |
| `workflowLogs` | `WorkflowLog[]` | Workflow event logs |
| `attachments` | `TaskAttachment[]` | File attachments |
| `sapIdentifiers` | `SAPTaskIdentifiers` | SAP-side identifiers |

### TaskInformationBundle
Lightweight variant for fast first render (no tabs).

| Field | Type | Description |
|---|---|---|
| `task` | `InboxTask` | Normalized task header |
| `decisions` | `Decision[]` | Available decision options |
| `description` | `TaskDescription \| undefined` | Task description |
| `customAttributes` | `CustomAttribute[]` | Sorted custom attributes |
| `taskObjects` | `TaskObject[]` | Linked business objects |
| `sapIdentifiers` | `SAPTaskIdentifiers` | SAP-side identifiers |

### SAPTaskIdentifiers
Opaque SAP reference data passed between adapter and service.

| Field | Type | Description |
|---|---|---|
| `instanceId` | `string` | SAP InstanceID |
| `sapOrigin` | `string \| undefined` | SAP__Origin value |
| `taskDefinitionId` | `string \| undefined` | TaskDefinitionID (for attr definition lookup) |

### TaskDecisionResult
Result of a write operation (decision / forward).

| Field | Type | Description |
|---|---|---|
| `success` | `boolean` | Whether the operation succeeded |
| `message` | `string` | Descriptive message |

### CommentResult
Result of adding a comment.

| Field | Type | Description |
|---|---|---|
| `commentId` | `string` | Returned comment ID from SAP |

### AttachmentStreamResult
Result of streaming an attachment.

| Field | Type | Description |
|---|---|---|
| `data` | `Buffer` | Binary content |
| `contentType` | `string` | MIME type |
| `fileName` | `string \| undefined` | Original file name |

---

## 2. DTOs (`srv/domain/inbox/inbox-task.dto.ts`)

Input contracts consumed by adapters. Independent of frontend request shapes.

### ExecuteDecisionInput
| Field | Type | Description |
|---|---|---|
| `instanceId` | `string` | Task instance ID |
| `decisionKey` | `string` | SAP decision key (e.g., `0001`) |
| `comment` | `string?` | Optional decision comment |

### ForwardTaskInput
| Field | Type | Description |
|---|---|---|
| `instanceId` | `string` | Task instance ID |
| `forwardTo` | `string` | Target user ID |

### AddAttachmentInput
| Field | Type | Description |
|---|---|---|
| `instanceId` | `string` | Task instance ID |
| `fileName` | `string` | File name |
| `mimeType` | `string` | MIME type |
| `buffer` | `Buffer` | File content |
| `sapOrigin` | `string?` | Optional SAP origin |

---

## 3. Transport Context (`srv/integrations/sap/task-transport-utils.ts`)

### AdapterContext
Passed from business service to all adapters.

| Field | Type | Description |
|---|---|---|
| `sapUser` | `string` | SAP backend user ID |
| `userJwt` | `string?` | JWT for principal propagation |
