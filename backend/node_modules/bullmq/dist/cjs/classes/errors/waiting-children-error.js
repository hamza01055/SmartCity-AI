"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaitingChildrenError = exports.WAITING_CHILDREN_ERROR = void 0;
exports.WAITING_CHILDREN_ERROR = 'bullmq:movedToWaitingChildren';
/**
 * WaitingChildrenError
 *
 * Error to be thrown when job is moved to waiting-children state
 * from job in active state.
 *
 */
class WaitingChildrenError extends Error {
    constructor(message = exports.WAITING_CHILDREN_ERROR) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.WaitingChildrenError = WaitingChildrenError;
