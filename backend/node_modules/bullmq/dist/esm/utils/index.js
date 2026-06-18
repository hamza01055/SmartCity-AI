import { randomBytes, randomUUID as cryptoRandomUUID } from 'crypto';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { CONNECTION_CLOSED_ERROR_MSG } from 'ioredis/built/utils';
import { ConnectionClosedError } from '../classes/errors/connection-closed-error';
import * as semver from 'semver';
import { SpanKind, TelemetryAttributes } from '../enums';
export const errorObject = { value: null };
export function tryCatch(fn, ctx, args) {
    try {
        return fn.apply(ctx, args);
    }
    catch (e) {
        errorObject.value = e;
        return errorObject;
    }
}
/**
 * Returns the size of a string in UTF-8 bytes (handles multi-byte characters correctly).
 * @see https://stackoverflow.com/a/23318053/1347170
 * @param str - The string to measure.
 * @returns The byte length of the string when encoded as UTF-8.
 */
export function lengthInUtf8Bytes(str) {
    return Buffer.byteLength(str, 'utf8');
}
export function isEmpty(obj) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}
export function array2obj(arr) {
    const obj = {};
    for (let i = 0; i < arr.length; i += 2) {
        obj[arr[i]] = arr[i + 1];
    }
    return obj;
}
export function objectToFlatArray(obj) {
    const arr = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) &&
            obj[key] !== undefined) {
            arr[arr.length] = key;
            arr[arr.length] = obj[key];
        }
    }
    return arr;
}
export function delay(ms, abortController) {
    return new Promise(resolve => {
        // eslint-disable-next-line prefer-const
        let timeout;
        const callback = () => {
            abortController === null || abortController === void 0 ? void 0 : abortController.signal.removeEventListener('abort', callback);
            clearTimeout(timeout);
            resolve();
        };
        timeout = setTimeout(callback, ms);
        abortController === null || abortController === void 0 ? void 0 : abortController.signal.addEventListener('abort', callback);
    });
}
export function increaseMaxListeners(emitter, count) {
    const maxListeners = emitter.getMaxListeners();
    emitter.setMaxListeners(maxListeners + count);
}
export function invertObject(obj) {
    return Object.entries(obj).reduce((result, [key, value]) => {
        result[value] = key;
        return result;
    }, {});
}
export const optsDecodeMap = {
    de: 'deduplication',
    fpof: 'failParentOnFailure',
    cpof: 'continueParentOnFailure',
    idof: 'ignoreDependencyOnFailure',
    kl: 'keepLogs',
    rdof: 'removeDependencyOnFailure',
};
export const optsEncodeMap = Object.assign(Object.assign({}, invertObject(optsDecodeMap)), { 
    /*/ Legacy for backwards compatibility */ debounce: 'de' });
export function isRedisInstance(obj) {
    if (!obj) {
        return false;
    }
    const redisApi = ['connect', 'disconnect', 'duplicate'];
    return redisApi.every(name => typeof obj[name] === 'function');
}
export function isRedisCluster(obj) {
    return isRedisInstance(obj) && !!obj.isCluster;
}
export function decreaseMaxListeners(emitter, count) {
    increaseMaxListeners(emitter, -count);
}
export async function removeAllQueueData(client, queueName, prefix = process.env.BULLMQ_TEST_PREFIX || 'bull') {
    if (client.isCluster) {
        // scanStream is not cluster-safe across all key slots.
        // Applies to adapter clients and raw ioredis Cluster clients alike.
        // @see https://github.com/luin/ioredis/issues/175
        return false;
    }
    const pattern = `${prefix}:${queueName}:*`;
    const pendingOperations = [];
    await new Promise((resolve, reject) => {
        const stream = client.scanStream({
            match: pattern,
        });
        stream.on('data', (keys) => {
            if (keys.length) {
                const pipeline = client.pipeline();
                keys.forEach(key => {
                    pipeline.del(key);
                });
                const execPromise = pipeline.exec().catch(error => {
                    reject(error);
                    throw error;
                });
                pendingOperations.push(execPromise);
            }
        });
        stream.on('end', () => resolve());
        stream.on('error', error => reject(error));
    });
    // Wait for all pipeline operations to complete before closing the connection
    await Promise.all(pendingOperations);
    // Handle connection close with better error handling for Dragonfly
    try {
        await client.quit();
    }
    catch (error) {
        if (isNotConnectionError(error)) {
            throw error;
        }
    }
}
export function getParentKey(opts) {
    if (opts) {
        return `${opts.queue}:${opts.id}`;
    }
}
export const clientCommandMessageReg = /ERR unknown command ['`]\s*client\s*['`]/;
export const DELAY_TIME_5 = 5000;
export const DELAY_TIME_1 = 100;
export function isNotConnectionError(error) {
    if (error instanceof ConnectionClosedError) {
        return false;
    }
    const { code, message: errorMessage } = error;
    return (errorMessage !== CONNECTION_CLOSED_ERROR_MSG &&
        !errorMessage.includes('ECONNREFUSED') &&
        code !== 'ECONNREFUSED');
}
export const asyncSend = (proc, msg) => {
    return new Promise((resolve, reject) => {
        if (typeof proc.send === 'function') {
            proc.send(msg, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }
        else if (typeof proc.postMessage === 'function') {
            resolve(proc.postMessage(msg));
        }
        else {
            resolve();
        }
    });
};
export const childSend = (proc, msg) => asyncSend(proc, msg);
export const isRedisVersionLowerThan = (currentVersion, minimumVersion, currentDatabaseType, desiredDatabaseType = 'redis') => {
    if (currentDatabaseType === desiredDatabaseType) {
        const version = semver.valid(semver.coerce(currentVersion));
        return semver.lt(version, minimumVersion);
    }
    return false;
};
export const parseObjectValues = (obj) => {
    const accumulator = {};
    for (const value of Object.entries(obj)) {
        accumulator[value[0]] = JSON.parse(value[1]);
    }
    return accumulator;
};
const getCircularReplacer = (rootReference) => {
    const references = new WeakSet();
    references.add(rootReference);
    return (_, value) => {
        if (typeof value === 'object' && value !== null) {
            if (references.has(value)) {
                return '[Circular]';
            }
            references.add(value);
        }
        return value;
    };
};
export const errorToJSON = (value) => {
    const error = {};
    Object.getOwnPropertyNames(value).forEach(function (propName) {
        error[propName] = value[propName];
    });
    return JSON.parse(JSON.stringify(error, getCircularReplacer(value)));
};
const INFINITY = 1 / 0;
export const toString = (value) => {
    if (value == null) {
        return '';
    }
    // Exit early for strings to avoid a performance hit in some environments.
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value)) {
        // Recursively convert values (susceptible to call stack limits).
        return `${value.map(other => (other == null ? other : toString(other)))}`;
    }
    if (typeof value == 'symbol' ||
        Object.prototype.toString.call(value) == '[object Symbol]') {
        return value.toString();
    }
    const result = `${value}`;
    return result === '0' && 1 / value === -INFINITY ? '-0' : result;
};
export const QUEUE_EVENT_SUFFIX = ':qe';
export function removeUndefinedFields(obj) {
    const newObj = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}
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
export async function trace(telemetry, spanKind, queueName, operation, destination, callback, srcPropagationMetadata) {
    if (!telemetry) {
        return callback();
    }
    else {
        const { tracer, contextManager } = telemetry;
        const currentContext = contextManager.active();
        let parentContext;
        if (srcPropagationMetadata) {
            parentContext = contextManager.fromMetadata(currentContext, srcPropagationMetadata);
        }
        const spanName = destination ? `${operation} ${destination}` : operation;
        const span = tracer.startSpan(spanName, {
            kind: spanKind,
        }, parentContext);
        try {
            span.setAttributes({
                [TelemetryAttributes.QueueName]: queueName,
                [TelemetryAttributes.QueueOperation]: operation,
            });
            let messageContext;
            let dstPropagationMetadata;
            if (spanKind === SpanKind.CONSUMER && parentContext) {
                messageContext = span.setSpanOnContext(parentContext);
            }
            else {
                messageContext = span.setSpanOnContext(currentContext);
            }
            if (callback.length == 2) {
                dstPropagationMetadata = contextManager.getMetadata(messageContext);
            }
            return await contextManager.with(messageContext, () => callback(span, dstPropagationMetadata));
        }
        catch (err) {
            span.recordException(err);
            throw err;
        }
        finally {
            span.end();
        }
    }
}
/**
 * randomUUID helper to generate a UUID v4 using native crypto dependency.
 */
export function randomUUID() {
    if (typeof cryptoRandomUUID === 'function') {
        return cryptoRandomUUID();
    }
    const bytes = randomBytes(16);
    // Set version to 4 (bits 4-7 of the 7th byte)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant to RFC 4122 (bits 6-7 of the 9th byte)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [
        bytes.toString('hex', 0, 4),
        bytes.toString('hex', 4, 6),
        bytes.toString('hex', 6, 8),
        bytes.toString('hex', 8, 10),
        bytes.toString('hex', 10, 16),
    ].join('-');
}
