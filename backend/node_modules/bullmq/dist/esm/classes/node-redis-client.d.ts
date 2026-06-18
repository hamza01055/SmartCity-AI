import { IRedisClient } from '../interfaces/redis-client';
export type NodeRedisCommandArgument = string | Buffer;
export interface NodeRedisRawTransaction {
    hGetAll(key: string): this;
    hSet(key: string, data: Record<string, string | number>): this;
    hScan(key: string, cursor: string, options?: Record<string, unknown>): this;
    sMembers(key: string): this;
    sScan(key: string, cursor: string, options?: Record<string, unknown>): this;
    zRange(key: string, start: number, end: number): this;
    lRange(key: string, start: number, end: number): this;
    lLen(key: string): this;
    del(keys: string[]): this;
    evalSha(sha: string, options: {
        keys: string[];
        arguments: NodeRedisCommandArgument[];
    }): this;
    exec(): Promise<unknown[] | null>;
}
export interface NodeRedisRawClient {
    isReady: boolean;
    isOpen: boolean;
    options?: Record<string, unknown>;
    on(event: string, listener: (...args: any[]) => void): this;
    connect(): Promise<unknown>;
    close?(): Promise<void>;
    destroy(): void | Promise<void>;
    quit(): Promise<unknown>;
    duplicate(): NodeRedisRawClient;
    scriptLoad(lua: string): Promise<unknown>;
    evalSha<T = unknown>(sha: string, options: {
        keys: string[];
        arguments: NodeRedisCommandArgument[];
    }): Promise<T>;
    eval<T = unknown>(lua: string, options: {
        keys: string[];
        arguments: NodeRedisCommandArgument[];
    }): Promise<T>;
    multi(): NodeRedisRawTransaction;
    hGetAll(key: string): Promise<Record<string, string>>;
    hGet(key: string, field: string): Promise<string | null | undefined>;
    hmGet(key: string, fields: string[]): Promise<(string | null | undefined)[]>;
    hSet(key: string, data: Record<string, string | number>): Promise<number>;
    hDel(key: string, fields: string[]): Promise<number>;
    hExists(key: string, field: string): Promise<boolean>;
    get(key: string): Promise<string | null | undefined>;
    set(key: string, value: string, options?: Record<string, unknown>): Promise<string | null>;
    del(keys: string[]): Promise<number>;
    zRange(key: string, start: number, end: number, options?: Record<string, unknown>): Promise<string[]>;
    zRangeWithScores?(key: string, start: number, end: number, options?: Record<string, unknown>): Promise<{
        value: string;
        score: number;
    }[]>;
    zCard(key: string): Promise<number>;
    zScore(key: string, member: string): Promise<number | string | null>;
    zAdd(key: string, members: {
        score: number;
        value: string;
    }[]): Promise<number>;
    zRem(key: string, members: string[]): Promise<number>;
    lRange(key: string, start: number, end: number): Promise<string[]>;
    lLen(key: string): Promise<number>;
    lTrim(key: string, start: number, end: number): Promise<unknown>;
    lPos(key: string, value: string): Promise<number | null | undefined>;
    lPush(key: string, values: string[]): Promise<number>;
    rPop(key: string): Promise<string | null>;
    sMembers(key: string): Promise<string[]>;
    sAdd(key: string, members: string[]): Promise<number>;
    sCard(key: string): Promise<number>;
    xAdd(key: string, id: string, fields: Record<string, string>, options?: Record<string, unknown>): Promise<string>;
    xRead(streams: {
        key: string;
        id: string;
    }[], options?: Record<string, unknown>): Promise<any>;
    xTrim(key: string, strategy: 'MAXLEN', threshold: number, options?: Record<string, unknown>): Promise<number>;
    xLen(key: string): Promise<number>;
    xRevRange(key: string, end: string, start: string, options?: Record<string, unknown>): Promise<any[]>;
    bzPopMin(key: string, timeout: number): Promise<{
        key: string;
        value: string;
        score: number | string;
    } | null>;
    info(): Promise<string>;
    clientSetName(name: string): Promise<unknown>;
    sendCommand(args: string[]): Promise<string>;
    scan(cursor: string, options?: Record<string, unknown>): Promise<{
        cursor: number | string;
        keys: string[];
    }>;
    scanIterator(options?: Record<string, unknown>): AsyncIterable<string | string[]>;
    keys(pattern: string): Promise<string[]>;
    exists(keys: string[]): Promise<number>;
    incr(key: string): Promise<number>;
    incrBy(key: string, increment: number): Promise<number>;
    flushAll(): Promise<string>;
}
export declare function createNodeRedisClient<TClient extends NodeRedisRawClient>(client: TClient): IRedisClient;
