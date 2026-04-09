/**
 * Inbox Module — Barrel Export
 * Single entry point for all inbox-related functionality.
 */
export { InboxService, getInboxService } from './inbox-service';
export { createInboxRouter } from './inbox-router';
export { resolveIdentity, assertSapUser } from './identity-resolver';
export { resolveBusinessContext, getContextLabel } from './business-context-resolver';
export { DecisionHandler, DecisionError } from './decision-handler';
export type { ISapTaskClient } from './sap-task-client';
