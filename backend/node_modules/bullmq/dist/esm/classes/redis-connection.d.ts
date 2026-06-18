import { EventEmitter } from 'events';
import { ConnectionOptions, RedisOptions, RedisClient } from '../interfaces';
import { IRedisClient } from '../interfaces/redis-client';
import { DatabaseType } from '../types';
interface RedisCapabilities {
    canDoubleTimeout: boolean;
    canBlockFor1Ms: boolean;
}
export interface RawCommand {
    content: string;
    name: string;
    keys: number;
}
export declare class RedisConnection extends EventEmitter {
    private readonly extraOptions?;
    static minimumVersion: string;
    static recommendedMinimumVersion: string;
    /**
     * Optional factory that creates an {@link IRedisClient} from raw options.
     *
     * When set, {@link RedisConnection} will call this factory instead of
     * creating an ioredis client internally.  This allows swapping the Redis
     * driver (e.g. node-redis, Bun built-in) without changing consumer code.
     *
     * The factory receives the merged {@link RedisOptions} and must return
     * an **already-augmented** {@link IRedisClient} (e.g. via
     * `createNodeRedisClient`).
     *
     * @example
     * ```ts
     * import { createClient } from 'redis';
     * import { RedisConnection, createNodeRedisClient } from 'bullmq';
     *
     * RedisConnection.clientFactory = (opts) => {
     *   const raw = createClient({ url: `redis://${opts.host ?? '127.0.0.1'}:${opts.port ?? 6379}` });
     *   return createNodeRedisClient(raw);
     * };
     * ```
     */
    static clientFactory?: (opts: RedisOptions) => IRedisClient;
    closing: boolean;
    capabilities: RedisCapabilities;
    status: 'initializing' | 'ready' | 'closing' | 'closed';
    private dbType;
    protected _client: RedisClient;
    private readonly opts;
    private readonly initializing;
    private version;
    protected packageVersion: string;
    private skipVersionCheck;
    private handleClientError;
    private handleClientClose;
    private handleClientReady;
    private patchedBlockingClusterClient?;
    private disabledBlockingClusterReconnect;
    constructor(opts: ConnectionOptions, extraOptions?: {
        shared?: boolean;
        blocking?: boolean;
        skipVersionCheck?: boolean;
        skipWaitingForReady?: boolean;
        clusterReconnectTimeoutMs?: number;
    });
    private checkBlockingOptions;
    /**
     * Waits for a redis client to be ready.
     * @param redis - client
     */
    static waitUntilReady(client: RedisClient): Promise<void>;
    get client(): Promise<RedisClient>;
    protected loadCommands(packageVersion: string, providedScripts?: Record<string, RawCommand>): void;
    private init;
    private patchBlockingClusterClient;
    private disableBlockingClusterReconnect;
    private releaseBlockingClusterClientPatch;
    private static isClusterWithEmptyNodes;
    private static isReconnectingDisabled;
    private static reconnectClusterIfNeeded;
    private static shouldReconnectClusterAfterError;
    private static reconnectCluster;
    private static connectClusterWithTimeout;
    disconnect(wait?: boolean): Promise<void>;
    reconnect(): Promise<void>;
    close(force?: boolean): Promise<void>;
    private getRedisVersionAndType;
    get redisVersion(): string;
    get databaseType(): DatabaseType;
}
export {};
