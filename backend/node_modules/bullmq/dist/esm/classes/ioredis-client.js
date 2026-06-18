/**
 * Per-raw-client cache so repeated calls to `createIORedisClient` with the
 * same underlying ioredis instance return the same proxy. This preserves
 * event-listener identity for the BullMQ-facing client.
 */
const proxyCache = new WeakMap();
/**
 * Wraps an ioredis `Redis` / `Cluster` instance with a `Proxy` so it conforms
 * to {@link IRedisClient}.
 *
 * For backwards compatibility BullMQ continues to accept a raw `IORedis`
 * instance through tehe `connection` option, even though internally it relies
 * on the `IRedisClient` adapter interface. The returned proxy:
 *
 *   - exposes `runCommand` (Lua script dispatch by name)
 *   - exposes structured-options variants of `hset`, `set`, `zrange`,
 *     `zrevrange`, `xadd`, `xread`, `xtrim`, `scan` (backward-compatible:
 *     they still accept native ioredis varargs if called that way)
 *   - returns augmented {@link IRedisTransaction}s from `pipeline()` / `multi()`
 *   - wraps the result of `duplicate()` in a new proxy
 *
 * The underlying ioredis instance is **not** mutated. Properties and methods
 * not in the override table are forwarded to the raw client via the proxy
 * traps, with `this === target` so EventEmitter / Commander internals work
 * normally.
 */
export function createIORedisClient(client) {
    // If the caller already passed a proxy produced by this function, return
    // it as-is. Wrapping a proxy in a second proxy would defeat the WeakMap
    // cache (the inner raw client is no longer reachable from the outer
    // argument) and break listener-identity / equality checks for callers
    // that hold on to the original wrapper.
    if (client.__bullmq_iredis === true) {
        return client;
    }
    const cached = proxyCache.get(client);
    if (cached) {
        return cached;
    }
    const isCluster = client.isCluster === true;
    // Cache bound prototype methods so the returned function identity is
    // stable across accesses (important for `once`/`removeListener` patterns).
    const boundCache = new Map();
    // Override table — properties returned by the proxy without touching the
    // underlying ioredis instance. The arrow functions close over `client`
    // directly so ioredis internals always see the raw instance as `this`.
    const overrides = Object.create(null);
    overrides.__bullmq_iredis = true;
    overrides.isCluster = isCluster;
    // Lua script engine.
    overrides.runCommand = (name, args) => {
        return client[name](args);
    };
    // Pipeline / Multi — wrap the ChainableCommander with structured overrides.
    overrides.pipeline = (...args) => {
        return augmentTransaction(client.pipeline(...args));
    };
    overrides.multi = (...args) => {
        return augmentTransaction(client.multi(...args));
    };
    // duplicate — wrap the new raw client with a fresh proxy.
    // ioredis Cluster.duplicate(startupNodes?, options?) expects connection
    // options under `redisOptions`, while Redis.duplicate(options?) takes them
    // at the top level. Normalise so callers can always pass `{ connectionName }`.
    if (typeof client.duplicate === 'function') {
        overrides.duplicate = (opts) => {
            var _a;
            if (isCluster) {
                const existingRedisOpts = ((_a = client.options) === null || _a === void 0 ? void 0 : _a.redisOptions) || {};
                const mergedRedisOpts = opts
                    ? Object.assign(Object.assign({}, existingRedisOpts), opts) : existingRedisOpts;
                return createIORedisClient(client.duplicate(undefined, {
                    redisOptions: mergedRedisOpts,
                }));
            }
            return createIORedisClient(client.duplicate(opts));
        };
    }
    // --- Structured → ioredis varargs translations ---
    // Each override accepts both the IRedisClient structured-options form and
    // the native ioredis varargs form, dispatching by argument shape.
    // hset: structured { f1: v1 } → ioredis hset(key, f1, v1, …)
    overrides.hset = (key, dataOrField, ...rest) => {
        if (typeof dataOrField === 'string') {
            return client.hset(key, dataOrField, ...rest);
        }
        const args = [key];
        for (const [f, v] of Object.entries(dataOrField)) {
            args.push(f, v);
        }
        return client.hset(...args);
    };
    // set: structured { PX?: n } → ioredis set(key, value, 'PX', n)
    overrides.set = (key, value, optionsOrModifier, ...rest) => {
        if (typeof optionsOrModifier === 'string' || optionsOrModifier == null) {
            return client.set(key, value, ...(optionsOrModifier != null ? [optionsOrModifier, ...rest] : []));
        }
        const args = [key, value];
        if (optionsOrModifier.PX != null) {
            args.push('PX', optionsOrModifier.PX);
        }
        else if (optionsOrModifier.EX != null) {
            args.push('EX', optionsOrModifier.EX);
        }
        return client.set(...args);
    };
    // zrange: structured { WITHSCORES? } → ioredis zrange(key, start, end, 'WITHSCORES')
    overrides.zrange = (key, start, end, optionsOrStr, ...rest) => {
        if (typeof optionsOrStr === 'string') {
            return client.zrange(key, start, end, optionsOrStr, ...rest);
        }
        if (optionsOrStr === null || optionsOrStr === void 0 ? void 0 : optionsOrStr.WITHSCORES) {
            return client.zrange(key, start, end, 'WITHSCORES');
        }
        return client.zrange(key, start, end);
    };
    // zrevrange: structured { WITHSCORES? } → ioredis zrevrange(key, start, end, 'WITHSCORES')
    overrides.zrevrange = (key, start, end, optionsOrStr, ...rest) => {
        if (typeof optionsOrStr === 'string') {
            return client.zrevrange(key, start, end, optionsOrStr, ...rest);
        }
        if (optionsOrStr === null || optionsOrStr === void 0 ? void 0 : optionsOrStr.WITHSCORES) {
            return client.zrevrange(key, start, end, 'WITHSCORES');
        }
        return client.zrevrange(key, start, end);
    };
    // xadd: structured (key, id, { field: value }, { MAXLEN? }) → ioredis varargs
    overrides.xadd = (key, idOrModifier, fieldsOrArg, ...rest) => {
        if (typeof fieldsOrArg === 'string') {
            return client.xadd(key, idOrModifier, fieldsOrArg, ...rest);
        }
        const options = rest[0];
        const args = [key];
        if ((options === null || options === void 0 ? void 0 : options.MAXLEN) != null) {
            args.push('MAXLEN');
            if (options.approximate !== false) {
                args.push('~');
            }
            args.push(options.MAXLEN);
        }
        args.push(idOrModifier);
        for (const [f, v] of Object.entries(fieldsOrArg)) {
            args.push(f, v);
        }
        return client.xadd(...args);
    };
    // xread: structured ([{ key, id }], { BLOCK?, COUNT? }) → ioredis varargs
    overrides.xread = (streamsOrModifier, ...rest) => {
        if (typeof streamsOrModifier === 'string') {
            return client.xread(streamsOrModifier, ...rest);
        }
        const options = rest[0];
        const args = [];
        if ((options === null || options === void 0 ? void 0 : options.BLOCK) != null) {
            args.push('BLOCK', options.BLOCK);
        }
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            args.push('COUNT', options.COUNT);
        }
        args.push('STREAMS');
        for (const s of streamsOrModifier) {
            args.push(s.key);
        }
        for (const s of streamsOrModifier) {
            args.push(s.id);
        }
        return client.xread(...args);
    };
    // xtrim: structured (key, 'MAXLEN', threshold, { approximate? })
    overrides.xtrim = (key, strategy, thresholdOrApprox, ...rest) => {
        if (typeof thresholdOrApprox === 'string' || rest.length === 0) {
            return client.xtrim(key, strategy, thresholdOrApprox, ...rest);
        }
        const options = rest[0];
        const args = [key, strategy];
        if ((options === null || options === void 0 ? void 0 : options.approximate) !== false) {
            args.push('~');
        }
        args.push(thresholdOrApprox);
        return client.xtrim(...args);
    };
    // bzpopmin is not overridden — ioredis already returns
    // `[key, member, score]`, which matches IRedisClient.
    // clientSetName / clientList helpers that forward to CLIENT subcommands.
    overrides.clientSetName = (name) => client.client('SETNAME', name);
    overrides.clientList = () => client.client('LIST');
    // scan(cursor, { MATCH?, COUNT? }) — accepts either structured options or
    // ioredis varargs (used internally by `scanStream`).
    overrides.scan = (cursor, ...rest) => {
        if (rest.length === 0 ||
            typeof rest[0] === 'string' ||
            typeof rest[0] === 'function') {
            return client.scan(cursor, ...rest);
        }
        const options = rest[0];
        const args = [cursor];
        if ((options === null || options === void 0 ? void 0 : options.MATCH) != null) {
            args.push('MATCH', options.MATCH);
        }
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            args.push('COUNT', options.COUNT);
        }
        return client.scan(...args);
    };
    const proxy = new Proxy(client, {
        get(target, prop) {
            if (prop in overrides) {
                return overrides[prop];
            }
            // Read against the raw target so getters on the prototype (e.g.
            // ioredis' EventEmitter internals) see `this === target` rather than
            // the proxy. This avoids infinite recursion through the proxy traps.
            const value = Reflect.get(target, prop, target);
            if (typeof value !== 'function') {
                return value;
            }
            // Own properties (including ioredis commands installed via
            // `defineCommand` and test-time spies set via `obj.method = spy`)
            // are bound fresh on each access so reassignment is honoured.
            if (Object.prototype.hasOwnProperty.call(target, prop)) {
                return value.bind(target);
            }
            // Prototype methods (EventEmitter, Commander, ...) are cached so
            // identity is stable across accesses.
            const cachedBound = boundCache.get(prop);
            if (cachedBound !== undefined) {
                return cachedBound;
            }
            const bound = value.bind(target);
            boundCache.set(prop, bound);
            return bound;
        },
        set(target, prop, value) {
            // Two assignment paths:
            //   - Properties present in the override table are reassigned in the
            //     table itself, so subsequent `get` traps return the new value
            //     (used by sinon-style spies that stub `runCommand`, `pipeline`,
            //     etc. on the proxy).
            //   - All other properties are written through to the raw ioredis
            //     instance via `Reflect.set`, and any stale bound-method entry is
            //     invalidated so the next access rebinds the new function.
            if (prop in overrides) {
                overrides[prop] = value;
                return true;
            }
            boundCache.delete(prop);
            return Reflect.set(target, prop, value);
        },
        deleteProperty(target, prop) {
            if (prop in overrides) {
                return false;
            }
            boundCache.delete(prop);
            return Reflect.deleteProperty(target, prop);
        },
        has(target, prop) {
            return prop in overrides || Reflect.has(target, prop);
        },
    });
    proxyCache.set(client, proxy);
    return proxy;
}
/**
 * Adds `runCommand` and structured overrides to an ioredis ChainableCommander
 * so it satisfies {@link IRedisTransaction}.
 */
function augmentTransaction(commander) {
    const transaction = commander;
    transaction.runCommand = function (name, args) {
        transaction[name](args);
        return transaction;
    };
    // hset(key, { f1: v1 }) → ioredis pipeline.hset(key, f1, v1, …)
    const origHset = transaction.hset.bind(transaction);
    transaction.hset = function (key, data) {
        const args = [key];
        for (const [f, v] of Object.entries(data)) {
            args.push(f, v);
        }
        origHset(...args);
        return transaction;
    };
    // hscan(key, cursor, { COUNT? }) → ioredis hscan(key, cursor, 'COUNT', n)
    const origHscan = transaction.hscan.bind(transaction);
    transaction.hscan = function (key, cursor, options) {
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            origHscan(key, cursor, 'COUNT', options.COUNT);
        }
        else {
            origHscan(key, cursor);
        }
        return transaction;
    };
    // sscan(key, cursor, { COUNT? })
    const origSscan = transaction.sscan.bind(transaction);
    transaction.sscan = function (key, cursor, options) {
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            origSscan(key, cursor, 'COUNT', options.COUNT);
        }
        else {
            origSscan(key, cursor);
        }
        return transaction;
    };
    return transaction;
}
/**
 * Check if an object already implements {@link IRedisClient}.
 */
export function isIRedisClient(obj) {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    // Fast path for ioredis instances already wrapped by `createIORedisClient`.
    if (obj.__bullmq_iredis === true) {
        return true;
    }
    // Fallback structural check for wrapper-based adapters
    // (node-redis, Bun, or custom IRedisClient implementations).
    return (typeof obj.runCommand === 'function' &&
        typeof obj.defineCommand === 'function' &&
        typeof obj.pipeline === 'function' &&
        typeof obj.multi === 'function' &&
        typeof obj.duplicate === 'function' &&
        typeof obj.scanStream === 'function' &&
        typeof obj.connect === 'function' &&
        typeof obj.disconnect === 'function' &&
        typeof obj.on === 'function' &&
        typeof obj.status === 'string' &&
        typeof obj.isCluster === 'boolean');
}
