# Phase 2 — Error Model Reference

> Deliverable for Workstream G: Error normalization model and classification rules.

---

## 1. Error Categories (`InboxErrorCategory`)

| Category | HTTP Status | When Applied |
|---|---|---|
| `AUTH_ERROR` | 401 | 401 response, "unauthorized" in message |
| `PROPAGATION_ERROR` | 403 | "principal propagation", "user mapping", "no sap user" |
| `DESTINATION_ERROR` | 502 | "destination", "connectivity", ECONNREFUSED, ENOTFOUND |
| `CSRF_ERROR` | 403 | "csrf", "x-csrf-token" in message |
| `SAP_HTTP_ERROR` | 502 | Any 4xx/5xx from SAP not matching above categories |
| `SAP_BUSINESS_ERROR` | 422 | SAP OData error body with `error.message` present |
| `INVALID_INPUT` | 400 | "required", "invalid", "missing" in message |
| `NOT_FOUND` | 404 | 404 response, "not found" in message |
| `UNEXPECTED_ERROR` | 500 | Fallback for unclassified errors |

---

## 2. InboxError Class

```typescript
class InboxError extends Error {
    category: InboxErrorCategory;  // Classification
    operation: string;             // e.g. "task.query.fetchTasks"
    statusCode: number;            // HTTP status (derived from category)
    cause?: Error;                 // Original error for debugging
}
```

### Usage in adapters

```typescript
try {
    return await this.sapClient.fetchTasks(...);
} catch (error) {
    throw classifyAndWrapError(error, 'task.query.fetchTasks');
}
```

### Classification flow

```
Raw Error
  → classifyError(error) → InboxErrorCategory
  → classifyAndWrapError(error, operation) → InboxError
      → logs { event: "task.error.normalized", operation, category, httpStatus, message }
      → returns InboxError with statusCode derived from category
```

---

## 3. Key Design Decisions

1. **Classification is message-based and status-based** — checked in priority order (auth → propagation → destination → CSRF → not_found → input → business → http → unexpected).

2. **IdInboxError already-wrapped errors pass through** — if the error is already an `InboxError`, it is returned as-is without re-wrapping.

3. **DecisionError is separate** — `DecisionHandler` throws `DecisionError` which is a distinct error class. The decision adapter lets it bubble through without wrapping.

4. **Logs are safe** — error messages are truncated to 200 chars in structured logs to avoid leaking large SAP payloads.

5. **Unstable SAP structures don't leak** — raw error response bodies are not included in the normalized error. Only the extracted message and HTTP status are preserved.
