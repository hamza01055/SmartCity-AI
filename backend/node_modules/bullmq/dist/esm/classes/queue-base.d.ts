import { EventEmitter } from 'events';
import { MinimalQueue, QueueBaseOptions, RedisClient, Span } from '../interfaces';
import { RedisConnection } from './redis-connection';
import { Job } from './job';
import { KeysMap } from './queue-keys';
import { Scripts } from './scripts';
import { SpanKind } from '../enums';
import { DatabaseType } from '../types/database-type';
/**
 * Base class for all classes that need to interact with queues.
 * This class is normally not used directly, but extended by the other classes.
 *
 */
export declare class QueueBase extends EventEmitter implements MinimalQueue {
    readonly name: string;
    opts: QueueBaseOptions;
    toKey: (type: string) => string;
    keys: KeysMap;
    closing: Promise<void> | undefined;
    protected closed: boolean;
    protected hasBlockingConnection: boolean;
    protected scripts: Scripts;
    protected connection: RedisConnection;
    readonly qualifiedName: string;
    /**
     *
     * @param name - The name of the queue.
     * @param opts - Options for the queue.
     * @param Connection - An optional "Connection" class used to instantiate a Connection. This is useful for
     * testing with mockups and/or extending the Connection class and passing an alternate implementation.
     */
    constructor(name: string, opts?: QueueBaseOptions, Connection?: typeof RedisConnection, hasBlockingConnection?: boolean);
    /**
     * Returns a promise that resolves to a redis client. Normally used only by subclasses.
     */
    get client(): Promise<RedisClient>;
    protected createScripts(): void;
    /**
     * Returns the version of the Redis instance the client is connected to,
     */
    get redisVersion(): string;
    /**
     * Returns the database type of the Redis instance the client is connected to,
     */
    get databaseType(): DatabaseType;
    /**
     * Helper to easily extend Job class calls.
     */
    protected get Job(): typeof Job;
    /**
     * Emits an event. Normally used by subclasses to emit events.
     *
     * @param event - The emitted event.
     * @param args - The arguments to pass to the event listeners.
     * @returns True if the event had listeners, false otherwise.
     */
    emit(event: string | symbol, ...args: any[]): boolean;
    waitUntilReady(): Promise<RedisClient>;
    protected base64Name(): string;
    protected clientName(suffix?: string): string;
    /**
     *
     * Closes the connection and returns a promise that resolves when the connection is closed.
     */
    close(): Promise<void>;
    /**
     *
     * Force disconnects a connection.
     */
    disconnect(): Promise<void>;
    protected checkConnectionError<T>(fn: () => Promise<T>, delayInMs?: number): Promise<T | undefined>;
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
    trace<T>(spanKind: SpanKind, operation: string, destination: string, callback: (span?: Span, dstPropagationMetadata?: string) => Promise<T> | T, srcPropagationMetadata?: string): Promise<T | Promise<T>>;
}
