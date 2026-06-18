import { EventEmitter } from 'events';
import { delay, DELAY_TIME_5, isNotConnectionError, isRedisInstance, trace, } from '../utils';
import { createScripts } from '../utils/create-scripts';
import { RedisConnection } from './redis-connection';
import { Job } from './job';
import { QueueKeys } from './queue-keys';
/**
 * Base class for all classes that need to interact with queues.
 * This class is normally not used directly, but extended by the other classes.
 *
 */
export class QueueBase extends EventEmitter {
    /**
     *
     * @param name - The name of the queue.
     * @param opts - Options for the queue.
     * @param Connection - An optional "Connection" class used to instantiate a Connection. This is useful for
     * testing with mockups and/or extending the Connection class and passing an alternate implementation.
     */
    constructor(name, opts = { connection: {} }, Connection = RedisConnection, hasBlockingConnection = false) {
        super();
        this.name = name;
        this.opts = opts;
        this.closed = false;
        this.hasBlockingConnection = false;
        this.hasBlockingConnection = hasBlockingConnection;
        this.opts = Object.assign({ prefix: 'bull' }, opts);
        if (!name) {
            throw new Error('Queue name must be provided');
        }
        if (name.includes(':')) {
            throw new Error('Queue name cannot contain :');
        }
        this.connection = new Connection(opts.connection, {
            shared: isRedisInstance(opts.connection),
            blocking: hasBlockingConnection,
            skipVersionCheck: opts.skipVersionCheck,
            skipWaitingForReady: opts.skipWaitingForReady,
        });
        this.connection.on('error', (error) => this.emit('error', error));
        this.connection.on('close', () => {
            if (!this.closing) {
                this.emit('ioredis:close');
            }
        });
        const queueKeys = new QueueKeys(opts.prefix);
        this.qualifiedName = queueKeys.getQueueQualifiedName(name);
        this.keys = queueKeys.getKeys(name);
        this.toKey = (type) => queueKeys.toKey(name, type);
        this.createScripts();
    }
    /**
     * Returns a promise that resolves to a redis client. Normally used only by subclasses.
     */
    get client() {
        return this.connection.client;
    }
    createScripts() {
        this.scripts = createScripts(this);
    }
    /**
     * Returns the version of the Redis instance the client is connected to,
     */
    get redisVersion() {
        return this.connection.redisVersion;
    }
    /**
     * Returns the database type of the Redis instance the client is connected to,
     */
    get databaseType() {
        return this.connection.databaseType;
    }
    /**
     * Helper to easily extend Job class calls.
     */
    get Job() {
        return Job;
    }
    /**
     * Emits an event. Normally used by subclasses to emit events.
     *
     * @param event - The emitted event.
     * @param args - The arguments to pass to the event listeners.
     * @returns True if the event had listeners, false otherwise.
     */
    emit(event, ...args) {
        try {
            return super.emit(event, ...args);
        }
        catch (err) {
            try {
                return super.emit('error', err);
            }
            catch (err) {
                // We give up if the error event also throws an exception.
                console.error(err);
                return false;
            }
        }
    }
    waitUntilReady() {
        return this.client;
    }
    base64Name() {
        return Buffer.from(this.name).toString('base64');
    }
    clientName(suffix = '') {
        const queueNameBase64 = this.base64Name();
        return `${this.opts.prefix}:${queueNameBase64}${suffix}`;
    }
    /**
     *
     * Closes the connection and returns a promise that resolves when the connection is closed.
     */
    async close() {
        if (!this.closing) {
            this.closing = this.connection.close();
        }
        await this.closing;
        this.closed = true;
    }
    /**
     *
     * Force disconnects a connection.
     */
    disconnect() {
        return this.connection.disconnect();
    }
    async checkConnectionError(fn, delayInMs = DELAY_TIME_5) {
        try {
            return await fn();
        }
        catch (error) {
            if (isNotConnectionError(error)) {
                this.emit('error', error);
            }
            if (!this.closing && delayInMs) {
                await delay(delayInMs);
            }
            else {
                return;
            }
        }
    }
    /**
     * Wraps the code with telemetry and provides a span for configuration.
     *
     * @param spanKind - kind of the span: Producer, Consumer, Internal
     * @param operation - operation name (such as add, process, etc)
     * @param destination - destination name (normally the queue name)
     * @param callback - code to wrap with telemetry
     * @param srcPropagationMetadata - The source propagation metadata for telemetry context.
     * @returns The result of the callback function.
     */
    trace(spanKind, operation, destination, callback, srcPropagationMetadata) {
        return trace(this.opts.telemetry, spanKind, this.name, operation, destination, callback, srcPropagationMetadata);
    }
}
