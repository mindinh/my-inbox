/**
 * Task Adapter — Re-export Bridge
 *
 * Phase 2: All normalization/mapping logic has been moved to
 * `srv/integrations/sap/task-mapper.ts` for better separation.
 *
 * This file remains for backward compatibility so that existing imports
 * from '../inbox/task-adapter' continue to resolve correctly.
 *
 * @see srv/integrations/sap/task-mapper.ts — Canonical location
 */

export {
    normalizeTask,
    normalizeTasks,
    normalizeDecisions,
    normalizeDescription,
    normalizeCustomAttributes,
    normalizeTaskObjects,
    normalizeComments,
    normalizeProcessingLogs,
    normalizeWorkflowLogs,
    normalizeAttachments,
} from '../../integrations/sap/task-mapper';
