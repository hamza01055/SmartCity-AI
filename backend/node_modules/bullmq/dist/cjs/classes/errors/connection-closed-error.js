"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionClosedError = void 0;
/**
 * Thrown by any BullMQ Redis adapter (ioredis, node-redis, Bun, …) when a
 * command fails because the connection is already closed or was closed
 * mid-flight.
 *
 * Using a single well-known class lets {@link isNotConnectionError} do a
 * structural `instanceof` check rather than fragile message-substring matching.
 */
class ConnectionClosedError extends Error {
    constructor(message, cause) {
        super(message !== null && message !== void 0 ? message : 'Connection is closed');
        this.cause = cause;
        this.name = 'ConnectionClosedError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.ConnectionClosedError = ConnectionClosedError;
