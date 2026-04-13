/**
 * Backward-compatible barrel for Inbox query/mutation hooks.
 *
 * Phase 2 split the monolithic useInbox.ts into:
 *   - inboxKeys.ts       — query key factory
 *   - inboxQueries.ts    — read-only query hooks
 *   - inboxMutations.ts  — mutation hooks
 *   - inboxInvalidation.ts — centralized invalidation policies
 *
 * Existing consumers can continue importing from this file without changes.
 * New code should import from the specific module directly.
 */

// Query key factory
export { inboxKeys } from './inboxKeys';

// Query hooks
export {
    useTasks,
    useApprovedTasks,
    useTaskInformation,
    useTaskDetail,
    useWorkflowApprovalTree,
} from './inboxQueries';

// Mutation hooks
export {
    useDecision,
    useForward,
    useAddComment,
    useAddAttachment,
} from './inboxMutations';
