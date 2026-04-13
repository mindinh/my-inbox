/**
 * Inbox Module — Barrel Export
 * Single entry point for all inbox-related functionality.
 */
export { InboxService, getInboxService } from './inbox-service';
export { createInboxRouter } from './inbox-router';
export { resolveIdentity, assertSapUser } from './resolvers/identity-resolver';
export { resolveBusinessContext, getContextLabel } from './resolvers/business-context-resolver';
export { DecisionHandler, DecisionError } from './handlers/decision-handler';
export type { ISapTaskClient } from './clients/sap-task-client';

// Phase 2: Re-export modular adapters and domain models for downstream consumers
export { TaskQueryAdapter } from '../integrations/sap/task-query-adapter';
export { TaskDetailAdapter } from '../integrations/sap/task-detail-adapter';
export { TaskDecisionAdapter } from '../integrations/sap/task-decision-adapter';
export type { AdapterContext } from '../integrations/sap/task-transport-utils';
export type {
    TaskQueryResult,
    TaskDetailBundle,
    TaskInformationBundle,
    TaskDecisionResult,
    CommentResult,
    AttachmentStreamResult,
    SAPTaskIdentifiers,
} from '../domain/inbox/inbox-task.models';
export { InboxErrorCategory, InboxError } from '../domain/inbox/inbox-error.types';
