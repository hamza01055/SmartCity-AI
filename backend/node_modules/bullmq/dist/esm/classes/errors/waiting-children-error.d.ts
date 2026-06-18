export declare const WAITING_CHILDREN_ERROR = "bullmq:movedToWaitingChildren";
/**
 * WaitingChildrenError
 *
 * Error to be thrown when job is moved to waiting-children state
 * from job in active state.
 *
 */
export declare class WaitingChildrenError extends Error {
    constructor(message?: string);
}
