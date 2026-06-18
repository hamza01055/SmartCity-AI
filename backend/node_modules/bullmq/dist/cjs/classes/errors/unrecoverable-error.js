"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnrecoverableError = exports.UNRECOVERABLE_ERROR = void 0;
exports.UNRECOVERABLE_ERROR = 'bullmq:unrecoverable';
/**
 * UnrecoverableError
 *
 * Error to move a job to failed even if the attemptsMade
 * are lower than the expected limit.
 *
 */
class UnrecoverableError extends Error {
    constructor(message = exports.UNRECOVERABLE_ERROR) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.UnrecoverableError = UnrecoverableError;
