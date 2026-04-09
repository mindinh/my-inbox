// My Inbox service — no CDS entities needed
// All data comes from SAP TASKPROCESSING OData via REST API (/api/inbox/*)
// This file is kept minimal to satisfy CDS build requirements.

service InboxService @(path: '/api/cnma/inbox') {
    // No entities — this is a passthrough BFF service
}
