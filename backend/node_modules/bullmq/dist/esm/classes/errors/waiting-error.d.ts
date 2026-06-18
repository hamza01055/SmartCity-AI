export declare const WAITING_ERROR = "bullmq:movedToWait";
/**
 * WaitingError
 *
 * Error to be thrown when job is moved to wait or prioritized state
 * from job in active state.
 */
export declare class WaitingError extends Error {
    constructor(message?: string);
}
