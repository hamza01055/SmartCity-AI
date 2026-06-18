/**
 * (c) 2017-2025 BullForce Labs AB, MIT Licensed.
 * @see LICENSE.md
 *
 */
/**
 * AsyncFifoQueue
 *
 * A minimal FIFO queue for asynchronous operations. Allows adding asynchronous operations
 * and consume them in the order they are resolved.
 */
export declare class AsyncFifoQueue<T> {
    private ignoreErrors;
    /**
     * A queue of completed promises. As the pending
     * promises are resolved, they are added to this queue.
     */
    private queue;
    /**
     * A set of pending promises.
     */
    private pending;
    /**
     * The next promise to be resolved. As soon as a pending promise
     * is resolved, this promise is resolved with the result of the
     * pending promise.
     */
    private nextPromise;
    private resolve;
    private reject;
    constructor(ignoreErrors?: boolean);
    /**
     * Adds a promise to the queue. When it resolves, its value is enqueued
     * and, if a consumer is waiting via {@link fetch}, the next pending
     * promise is resolved with the value.
     *
     * @param promise - The asynchronous operation to add to the queue.
     */
    add(promise: Promise<T>): void;
    /**
     * Waits for all currently pending promises to settle.
     *
     * @returns A promise that resolves once every in-flight promise has resolved.
     */
    waitAll(): Promise<void>;
    /**
     * Returns the total number of items currently tracked by the queue,
     * including both pending (in-flight) promises and resolved items that
     * have not yet been fetched.
     *
     * @returns The sum of pending and queued items.
     */
    numTotal(): number;
    /**
     * Returns the number of promises that are still pending (in-flight).
     *
     * @returns The number of unresolved promises currently in the queue.
     */
    numPending(): number;
    /**
     * Returns the number of items that have already resolved but have not
     * yet been fetched by a consumer.
     *
     * @returns The number of resolved items waiting to be consumed.
     */
    numQueued(): number;
    private resolvePromise;
    private rejectPromise;
    private newPromise;
    private wait;
    /**
     * Fetches the next resolved item from the queue in FIFO order. If no
     * items are currently resolved but pending promises exist, it waits
     * until the next one resolves.
     *
     * @returns The next resolved value, or `undefined` if there are no
     * pending or queued items.
     */
    fetch(): Promise<T | void>;
}
