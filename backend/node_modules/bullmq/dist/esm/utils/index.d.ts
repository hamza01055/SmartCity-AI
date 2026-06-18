import { Cluster, Redis } from 'ioredis';
import { AbortController } from '../classes/abort-controller';
import { ChildMessage, ContextManager, IRedisClient, ParentOptions, Span, Tracer } from '../interfaces';
import { SpanKind } from '../enums';
import { DatabaseType } from '../types';
export declare const errorObject: {
    [index: string]: any;
};
export declare function tryCatch(fn: (...args: any) => any, ctx: any, args: any[]): any;
/**
 * Returns the size of a string in UTF-8 bytes (handles multi-byte characters correctly).
 * @see https://stackoverflow.com/a/23318053/1347170
 * @param str - The string to measure.
 * @returns The byte length of the string when encoded as UTF-8.
 */
export declare function lengthInUtf8Bytes(str: string): number;
export declare function isEmpty(obj: object): boolean;
export declare function array2obj(arr: string[]): Record<string, string>;
export declare function objectToFlatArray(obj: Record<string, any>): string[];
export declare function delay(ms: number, abortController?: AbortController): Promise<void>;
export declare function increaseMaxListeners(emitter: {
    getMaxListeners(): number;
    setMaxListeners(n: number): any;
}, count: number): void;
type Invert<T extends Record<PropertyKey, PropertyKey>> = {
    [V in T[keyof T]]: {
        [K in keyof T]: T[K] extends V ? K : never;
    }[keyof T];
};
export declare function invertObject<T extends Record<PropertyKey, PropertyKey>>(obj: T): Invert<T>;
export declare const optsDecodeMap: {
    readonly de: "deduplication";
    readonly fpof: "failParentOnFailure";
    readonly cpof: "continueParentOnFailure";
    readonly idof: "ignoreDependencyOnFailure";
    readonly kl: "keepLogs";
    readonly rdof: "removeDependencyOnFailure";
};
export declare const optsEncodeMap: {
    readonly debounce: "de";
    readonly keepLogs: "kl";
    readonly deduplication: "de";
    readonly failParentOnFailure: "fpof";
    readonly continueParentOnFailure: "cpof";
    readonly ignoreDependencyOnFailure: "idof";
    readonly removeDependencyOnFailure: "rdof";
};
export declare function isRedisInstance(obj: any): obj is IRedisClient | Redis | Cluster;
export declare function isRedisCluster(obj: unknown): obj is IRedisClient & {
    isCluster: true;
};
export declare function decreaseMaxListeners(emitter: {
    getMaxListeners(): number;
    setMaxListeners(n: number): any;
}, count: number): void;
type RemoveAllQueueDataPipeline = {
    del(...keys: string[]): any;
    exec(): Promise<any>;
};
type RemoveAllQueueDataClient = {
    scanStream(options: {
        match: string;
        count?: number;
    }): {
        on(event: 'data', listener: (keys: string[]) => void): any;
        on(event: 'end', listener: () => void): any;
        on(event: 'error', listener: (error: Error) => void): any;
    };
    pipeline(): RemoveAllQueueDataPipeline;
    quit(): Promise<any>;
    isCluster?: boolean;
};
export declare function removeAllQueueData(client: RemoveAllQueueDataClient, queueName: string, prefix?: string): Promise<void | boolean>;
export declare function getParentKey(opts: ParentOptions): string | undefined;
export declare const clientCommandMessageReg: RegExp;
export declare const DELAY_TIME_5 = 5000;
export declare const DELAY_TIME_1 = 100;
export declare function isNotConnectionError(error: Error): boolean;
interface procSendLike {
    send?(message: any, callback?: (error: Error | null) => void): boolean;
    postMessage?(message: any): void;
}
export declare const asyncSend: <T extends procSendLike>(proc: T, msg: any) => Promise<void>;
export declare const childSend: (proc: NodeJS.Process, msg: ChildMessage) => Promise<void>;
export declare const isRedisVersionLowerThan: (currentVersion: string, minimumVersion: string, currentDatabaseType: DatabaseType, desiredDatabaseType?: DatabaseType) => boolean;
export declare const parseObjectValues: (obj: {
    [key: string]: string;
}) => Record<string, any>;
export declare const errorToJSON: (value: any) => Record<string, any>;
export declare const toString: (value: any) => string;
export declare const QUEUE_EVENT_SUFFIX = ":qe";
export declare function removeUndefinedFields<T extends Record<string, any>>(obj: Record<string, any>): T;
/**
 * Wraps the code with telemetry and provides a span for configuration.
 *
 * @param telemetry - telemetry configuration. If undefined, the callback will be executed without telemetry.
 * @param spanKind - kind of the span: Producer, Consumer, Internal
 * @param queueName - queue name
 * @param operation - operation name (such as add, process, etc)
 * @param destination - destination name (normally the queue name)
 * @param callback - code to wrap with telemetry
 * @param srcPropagationMetadata -
 * @returns
 */
export declare function trace<T>(telemetry: {
    tracer: Tracer;
    contextManager: ContextManager;
} | undefined, spanKind: SpanKind, queueName: string, operation: string, destination: string, callback: (span?: Span, dstPropagationMetadata?: string) => Promise<T> | T, srcPropagationMetadata?: string): Promise<T>;
/**
 * randomUUID helper to generate a UUID v4 using native crypto dependency.
 */
export declare function randomUUID(): string;
export {};
