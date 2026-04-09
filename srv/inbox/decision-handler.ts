import { Decision, DecisionRequest } from '../types';
import { ISapTaskClient } from './sap-task-client';

/**
 * Decision Handler
 *
 * Validates and executes workflow decisions against SAP.
 * Ensures the decision key exists, validates mandatory comments,
 * and handles SAP-side errors gracefully.
 */

export class DecisionHandler {
    constructor(private sapClient: ISapTaskClient) {}

    /**
     * Validate a decision request against available options.
     * Throws descriptive errors if validation fails.
     */
    validateDecision(request: DecisionRequest, availableDecisions: Decision[]): void {
        if (!request.decisionKey) {
            throw new DecisionError('Decision key is required.', 'MISSING_KEY');
        }

        const matchingDecision = availableDecisions.find(
            (d) => d.key === request.decisionKey
        );

        if (!matchingDecision) {
            const validKeys = availableDecisions.map((d) => `${d.key} (${d.text})`).join(', ');
            throw new DecisionError(
                `Invalid decision key "${request.decisionKey}". Valid options: ${validKeys}`,
                'INVALID_KEY'
            );
        }

        // Negative decisions (reject) typically require a comment
        if (matchingDecision.nature === 'NEGATIVE' && !request.comment?.trim()) {
            throw new DecisionError(
                `A comment is required for "${matchingDecision.text}" decisions.`,
                'COMMENT_REQUIRED'
            );
        }
    }

    /**
     * Execute a decision against SAP, with pre-validation if availableDecisions is provided.
     */
    async execute(
        sapUser: string,
        instanceId: string,
        request: DecisionRequest,
        availableDecisions: Decision[],
        userJwt?: string
    ): Promise<void> {
        // Validate before calling SAP
        if (!request.decisionKey) {
            throw new DecisionError('Decision key is required.', 'MISSING_KEY');
        }

        if (availableDecisions && availableDecisions.length > 0) {
            this.validateDecision(request, availableDecisions);
        }

        try {
            await this.sapClient.executeDecision(
                sapUser,
                instanceId,
                request.decisionKey,
                request.comment,
                userJwt
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new DecisionError(
                `SAP decision execution failed: ${message}`,
                'SAP_ERROR'
            );
        }
    }

    /**
     * Claim a task for the current user.
     */
    async claim(sapUser: string, instanceId: string, userJwt?: string): Promise<void> {
        try {
            await this.sapClient.claimTask(sapUser, instanceId, userJwt);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new DecisionError(
                `Failed to claim task: ${message}`,
                'SAP_ERROR'
            );
        }
    }

    /**
     * Release a claimed task back to the pool.
     */
    async release(sapUser: string, instanceId: string, userJwt?: string): Promise<void> {
        try {
            await this.sapClient.releaseTask(sapUser, instanceId, userJwt);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new DecisionError(
                `Failed to release task: ${message}`,
                'SAP_ERROR'
            );
        }
    }

    /**
     * Forward a task to another user.
     */
    async forward(
        sapUser: string,
        instanceId: string,
        forwardTo: string,
        userJwt?: string
    ): Promise<void> {
        if (!forwardTo?.trim()) {
            throw new DecisionError('Forward target user is required.', 'MISSING_TARGET');
        }

        try {
            await this.sapClient.forwardTask(
                sapUser,
                instanceId,
                forwardTo.trim().toUpperCase(),
                userJwt
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new DecisionError(
                `Failed to forward task: ${message}`,
                'SAP_ERROR'
            );
        }
    }
}

// ─── Decision Error ───────────────────────────────────────

export type DecisionErrorCode =
    | 'MISSING_KEY'
    | 'INVALID_KEY'
    | 'COMMENT_REQUIRED'
    | 'MISSING_TARGET'
    | 'SAP_ERROR';

export class DecisionError extends Error {
    constructor(
        message: string,
        public readonly code: DecisionErrorCode
    ) {
        super(message);
        this.name = 'DecisionError';
    }

    /** HTTP status code for this error type */
    get httpStatus(): number {
        switch (this.code) {
            case 'MISSING_KEY':
            case 'INVALID_KEY':
            case 'COMMENT_REQUIRED':
            case 'MISSING_TARGET':
                return 400; // Bad Request
            case 'SAP_ERROR':
                return 502; // Bad Gateway
            default:
                return 500;
        }
    }
}
