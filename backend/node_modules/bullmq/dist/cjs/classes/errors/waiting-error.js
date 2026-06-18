"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitingError = exports.WAITING_ERROR = void 0;
exports.WAITING_ERROR = 'bullmq:movedToWait';
/**
 * WaitingError
 *
 * Error to be thrown when job is moved to wait or prioritized state
 * from job in active state.
 */
class WaitingError extends Error {
    constructor(message = exports.WAITING_ERROR) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.WaitingError = WaitingError;
