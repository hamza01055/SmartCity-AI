"use strict";
/**
 * (c) 2017-2025 BullForce Labs AB, MIT Licensed.
 * @see LICENSE.md
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncFifoQueue = void 0;
class Node {
    constructor(value) {
        this.value = undefined;
        this.next = null;
        this.value = value;
    }
}
class LinkedList {
    constructor() {
        this.length = 0;
        this.head = null;
        this.tail = null;
    }
    push(value) {
        const newNode = new Node(value);
        if (!this.length) {
            this.head = newNode;
        }
        else {
            this.tail.next = newNode;
        }
        this.tail = newNode;
        this.length += 1;
        return newNode;
    }
    shift() {
        if (!this.length) {
            return null;
        }
        else {
            const head = this.head;
            this.head = this.head.next;
            this.length -= 1;
            return head;
        }
    }
}
/**
 * AsyncFifoQueue
 *
 * A minimal FIFO queue for asynchronous operations. Allows adding asynchronous operations
 * and consume them in the order they are resolved.
 */
class AsyncFifoQueue {
    constructor(ignoreErrors = false) {
        this.ignoreErrors = ignoreErrors;
        /**
         * A queue of completed promises. As the pending
         * promises are resolved, they are added to this queue.
         */
        this.queue = new LinkedList();
        /**
         * A set of pending promises.
         */
        this.pending = new Set();
        this.newPromise();
    }
    /**
     * Adds a promise to the queue. When it resolves, its value is enqueued
     * and, if a consumer is waiting via {@link fetch}, the next pending
     * promise is resolved with the value.
     *
     * @param promise - The asynchronous operation to add to the queue.
     */
    add(promise) {
        this.pending.add(promise);
        promise
            .then(data => {
            this.pending.delete(promise);
            if (this.queue.length === 0) {
                this.resolvePromise(data);
            }
            this.queue.push(data);
        })
            .catch(err => {
            // Ignore errors
            if (this.ignoreErrors) {
                this.queue.push(undefined);
            }
            this.pending.delete(promise);
            this.rejectPromise(err);
        });
    }
    /**
     * Waits for all currently pending promises to settle.
     *
     * @returns A promise that resolves once every in-flight promise has resolved.
     */
    async waitAll() {
        await Promise.all(this.pending);
    }
    /**
     * Returns the total number of items currently tracked by the queue,
     * including both pending (in-flight) promises and resolved items that
     * have not yet been fetched.
     *
     * @returns The sum of pending and queued items.
     */
    numTotal() {
        return this.pending.size + this.queue.length;
    }
    /**
     * Returns the number of promises that are still pending (in-flight).
     *
     * @returns The number of unresolved promises currently in the queue.
     */
    numPending() {
        return this.pending.size;
    }
    /**
     * Returns the number of items that have already resolved but have not
     * yet been fetched by a consumer.
     *
     * @returns The number of resolved items waiting to be consumed.
     */
    numQueued() {
        return this.queue.length;
    }
    resolvePromise(data) {
        this.resolve(data);
        this.newPromise();
    }
    rejectPromise(err) {
        this.reject(err);
        this.newPromise();
    }
    newPromise() {
        this.nextPromise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
    async wait() {
        return this.nextPromise;
    }
    /**
     * Fetches the next resolved item from the queue in FIFO order. If no
     * items are currently resolved but pending promises exist, it waits
     * until the next one resolves.
     *
     * @returns The next resolved value, or `undefined` if there are no
     * pending or queued items.
     */
    async fetch() {
        var _a;
        if (this.pending.size === 0 && this.queue.length === 0) {
            return;
        }
        while (this.queue.length === 0) {
            try {
                await this.wait();
            }
            catch (err) {
                // Ignore errors
                if (!this.ignoreErrors) {
                    console.error('Unexpected Error in AsyncFifoQueue', err);
                }
            }
        }
        return (_a = this.queue.shift()) === null || _a === void 0 ? void 0 : _a.value;
    }
}
exports.AsyncFifoQueue = AsyncFifoQueue;
