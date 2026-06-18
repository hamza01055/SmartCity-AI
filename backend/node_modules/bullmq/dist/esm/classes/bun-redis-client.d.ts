import { IRedisClient } from '../interfaces/redis-client';
export type RedisCommandArgument = string | Buffer;
export interface BunRedisRawClient {
    connected: boolean;
    url?: string;
    onconnect?: () => void;
    onclose?: (error?: Error) => void;
    onerror?: (error?: Error) => void;
    connect(): Promise<void>;
    close(): void;
    send<T = any>(command: string, args: RedisCommandArgument[]): Promise<T>;
    get(key: string): Promise<string | null | undefined>;
    smembers(key: string): Promise<unknown[] | null | undefined>;
    incr(key: string): Promise<number>;
}
export declare function createBunRedisClient<TClient extends BunRedisRawClient>(client: TClient, opts?: {
    lazyConnect?: boolean;
}): IRedisClient;
