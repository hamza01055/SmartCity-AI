"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelayedError = exports.DELAYED_ERROR = void 0;
exports.DELAYED_ERROR = 'bullmq:movedToDelayed';
/**
 * DelayedError
 *
 * Error to be thrown when job is moved to delayed state
 * from job in active state.
 *
 */
class DelayedError extends Error {
    constructor(message = exports.DELAYED_ERROR) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.DelayedError = DelayedError;
