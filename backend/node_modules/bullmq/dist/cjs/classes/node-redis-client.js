"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNodeRedisClient = createNodeRedisClient;
const tslib_1 = require("tslib");
const crypto_1 = require("crypto");
const events_1 = require("events");
const stream_1 = require("stream");
const connection_closed_error_1 = require("./errors/connection-closed-error");
function normalizeScriptArgs(args) {
    return args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
}
function isConnectionClosedError(err) {
    return ((err === null || err === void 0 ? void 0 : err.message) === 'Disconnects client' ||
        (err === null || err === void 0 ? void 0 : err.message) === 'The client is closed' ||
        (err === null || err === void 0 ? void 0 : err.message) === 'Connection is closed.');
}
function createNodeRedisClient(client) {
    return new NodeRedisAdapter(client);
}
/**
 * Full wrapper (not augmentation) because node-redis's API is structurally
 * different from ioredis and cannot be patched in-place.
 */
class NodeRedisAdapter extends events_1.EventEmitter {
    /**
     * Expose connection status using the vocabulary that
     * {@link RedisConnection.waitUntilReady} expects:
     *   'wait'  → not yet connected, call connect()
     *   'ready' → usable
     *   'end'   → permanently closed
     */
    get status() {
        if (this.statusOverride) {
            return this.statusOverride;
        }
        if (this.raw.isReady) {
            return 'ready';
        }
        if (this.raw.isOpen) {
            return 'connect';
        }
        // Distinguish "never connected" from "disconnected after use"
        return this.hasConnected ? 'end' : 'wait';
    }
    set status(val) {
        // Allow RedisConnection to forcibly set 'end'
        if (val === 'end') {
            this.destroying = true;
            if (this.raw.isOpen) {
                try {
                    this.raw.quit().catch(() => { });
                }
                catch (_a) {
                    // already closed
                }
            }
        }
        this.statusOverride = val;
    }
    get options() {
        var _a;
        return (_a = this.raw.options) !== null && _a !== void 0 ? _a : {};
    }
    set options(val) {
        // no-op – callers sometimes assign
    }
    constructor(raw) {
        super();
        this.raw = raw;
        this.scripts = new Map();
        this.hasConnected = false;
        this.destroying = false;
        this.isCluster = false; // TODO: cluster support
        // Track first connection so status can distinguish 'wait' vs 'end'.
        // When a connectionName is set (via duplicate()), delay the 'ready'
        // event until CLIENT SETNAME completes so that callers waiting for
        // 'ready' (e.g. RedisConnection.waitUntilReady) see the name already
        // applied.
        raw.on('ready', () => {
            this.hasConnected = true;
            if (this.connectionName) {
                this.raw.clientSetName(this.connectionName).then(() => this.emit('ready'), () => this.emit('ready'));
            }
            else {
                this.emit('ready');
            }
        });
        raw.on('error', (err) => {
            // Suppress the expected DisconnectsClientError that node-redis emits
            // when destroy() is called intentionally (e.g. during close/disconnect).
            if (this.destroying && isConnectionClosedError(err)) {
                return;
            }
            this.emit('error', err);
        });
        raw.on('end', () => this.emit('close'));
        raw.on('reconnecting', () => this.emit('reconnecting'));
        // Auto-connect eagerly, like ioredis does in its constructor.
        // This ensures commands can be issued immediately without an
        // explicit connect() call. The promise is stored so that
        // connect() is idempotent and callers can still await it.
        if (!raw.isOpen) {
            this.connectPromise = raw.connect().then(() => {
                this.connectPromise = undefined;
            }, (err) => {
                this.connectPromise = undefined;
                // Don't throw — errors surface via the 'error' event.
            });
        }
    }
    // ---------------------------------------------------------------
    // Connection lifecycle
    // ---------------------------------------------------------------
    async connect() {
        if (this.connectPromise) {
            return this.connectPromise;
        }
        if (!this.raw.isOpen) {
            this.connectPromise = this.raw.connect().then(() => {
                this.connectPromise = undefined;
            }, (err) => {
                this.connectPromise = undefined;
                throw err;
            });
            return this.connectPromise;
        }
        if (!this.raw.isReady) {
            await new Promise((resolve, reject) => {
                const onReady = () => {
                    cleanup();
                    resolve();
                };
                const onError = (err) => {
                    cleanup();
                    reject(err);
                };
                const onEnd = () => {
                    cleanup();
                    reject(new Error('Connection ended before ready event'));
                };
                const cleanup = () => {
                    this.off('ready', onReady);
                    this.off('error', onError);
                    this.off('end', onEnd);
                };
                this.once('ready', onReady);
                this.once('error', onError);
                this.once('end', onEnd);
            });
        }
    }
    disconnect(reconnect = false) {
        this.destroying = true;
        if (!reconnect) {
            this.statusOverride = 'end';
        }
        try {
            if (this.raw.isOpen) {
                // Use destroy() for immediate teardown. This interrupts any pending
                // blocking commands (e.g. BZPOPMIN) without waiting for them to
                // complete. The resulting "Disconnects client" rejections are handled
                // by BullMQ's isNotConnectionError() checks.
                this.raw.destroy();
            }
        }
        catch (_a) {
            // Swallow errors from already-closed connections
        }
        this.emit('close');
        if (reconnect) {
            this.statusOverride = undefined;
            this.emit('reconnecting');
            this.connect()
                .catch(err => {
                if (!isConnectionClosedError(err)) {
                    this.emit('error', err);
                }
            })
                .finally(() => {
                this.destroying = false;
            });
        }
        else {
            // Emit both 'close' and 'end' so that all listeners are unblocked.
            // RedisConnection.close() listens for 'close', RedisConnection.disconnect() listens for 'end'.
            this.emit('end');
        }
    }
    async quit() {
        if (this.destroying || this.statusOverride === 'end') {
            setImmediate(() => {
                this.emit('end');
                this.emit('close');
            });
            return 'OK';
        }
        this.destroying = true;
        try {
            if (this.raw.isOpen) {
                try {
                    await this.raw.quit();
                }
                catch (_a) {
                    // Swallow errors from already-closing connections
                }
            }
        }
        catch (_b) {
            // Swallow errors from already-closing connections
        }
        this.statusOverride = 'end';
        // Emit on next tick so callers can register listeners after await quit()
        setImmediate(() => {
            this.emit('end');
            this.emit('close');
        });
        return 'OK';
    }
    duplicate(...args) {
        const dup = this.raw.duplicate();
        const adapter = new NodeRedisAdapter(dup);
        // Copy registered scripts to the duplicate
        for (const [name, script] of this.scripts) {
            adapter.scripts.set(name, script);
            adapter[name] = (...args) => adapter.runCommand(name, args);
        }
        // Handle connectionName option (ioredis calls CLIENT SETNAME automatically).
        // Setting connectionName BEFORE auto-connect resolves ensures the
        // constructor's 'ready' handler applies CLIENT SETNAME before emitting
        // 'ready', so callers (like RedisConnection.waitUntilReady) see the name
        // already set when the connection is reported as ready.
        const opts = args[0];
        if (opts && typeof opts === 'object' && opts.connectionName) {
            adapter.connectionName = opts.connectionName;
        }
        return adapter;
    }
    // ---------------------------------------------------------------
    // Lua script engine
    // ---------------------------------------------------------------
    defineCommand(name, definition) {
        const sha = (0, crypto_1.createHash)('sha1').update(definition.lua).digest('hex');
        this.scripts.set(name, {
            sha,
            lua: definition.lua,
            numberOfKeys: definition.numberOfKeys,
        });
        // Mimic ioredis behavior: add a callable property on the instance
        // so that `(client as any)[name]` is defined (used by ScriptLoader cache check)
        this[name] = (...args) => this.runCommand(name, args);
        // Pre-load the script into Redis so that EVALSHA in transactions works
        // immediately. This mirrors what ioredis does under the hood.
        this.raw.scriptLoad(definition.lua).catch(() => {
            // Ignore errors here – runCommand has NOSCRIPT fallback for non-tx path
        });
    }
    async runCommand(name, args) {
        var _a, _b;
        const script = this.scripts.get(name);
        if (!script) {
            throw new Error(`BullMQ: unknown command "${name}"`);
        }
        const commandArgs = normalizeScriptArgs(args);
        const { sha, lua, numberOfKeys } = script;
        const keys = commandArgs.slice(0, numberOfKeys).map(String);
        // Preserve Buffer arguments (e.g. msgpack data) – only stringify non-Buffers.
        // Convert undefined/null to '' to match ioredis behavior (keeps arg positions).
        const argv = commandArgs.slice(numberOfKeys).map((a) => {
            if (Buffer.isBuffer(a)) {
                return a;
            }
            if (a === undefined || a === null) {
                return '';
            }
            return String(a);
        });
        try {
            return await this.raw.evalSha(sha, { keys, arguments: argv });
        }
        catch (err) {
            if (this.destroying && isConnectionClosedError(err)) {
                return null;
            }
            if (isConnectionClosedError(err)) {
                throw new connection_closed_error_1.ConnectionClosedError(err.message, err);
            }
            // NOSCRIPT – fall back to EVAL which also caches the script
            if ((_b = (_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.includes) === null || _b === void 0 ? void 0 : _b.call(_a, 'NOSCRIPT')) {
                try {
                    return await this.raw.eval(lua, { keys, arguments: argv });
                }
                catch (evalErr) {
                    if (this.destroying && isConnectionClosedError(evalErr)) {
                        return null;
                    }
                    if (isConnectionClosedError(evalErr)) {
                        throw new connection_closed_error_1.ConnectionClosedError(evalErr.message, evalErr);
                    }
                    throw evalErr;
                }
            }
            throw err;
        }
    }
    // ---------------------------------------------------------------
    // Pipeline / Transaction
    // ---------------------------------------------------------------
    multi() {
        return new NodeRedisTransaction(this.raw.multi(), this.scripts);
    }
    pipeline() {
        // node-redis doesn't have a separate pipeline concept;
        // use multi() which behaves similarly for batching.
        return this.multi();
    }
    // ---------------------------------------------------------------
    // Hash commands
    // ---------------------------------------------------------------
    async hgetall(key) {
        const result = await this.raw.hGetAll(key);
        return result !== null && result !== void 0 ? result : {};
    }
    async hget(key, field) {
        var _a;
        return (_a = (await this.raw.hGet(key, field))) !== null && _a !== void 0 ? _a : null;
    }
    async hmget(key, ...fields) {
        const result = await this.raw.hmGet(key, fields);
        return result.map((v) => v !== null && v !== void 0 ? v : null);
    }
    async hset(key, dataOrField, ...rest) {
        if (typeof dataOrField === 'object') {
            // Record-based call: hset(key, { field: value, ... })
            return await this.raw.hSet(key, dataOrField);
        }
        // Varargs call (ioredis compat): hset(key, field, value, field, value, ...)
        const record = {};
        record[dataOrField] = String(rest[0]);
        for (let i = 1; i < rest.length; i += 2) {
            record[String(rest[i])] = String(rest[i + 1]);
        }
        return await this.raw.hSet(key, record);
    }
    async hdel(key, ...fields) {
        return await this.raw.hDel(key, fields);
    }
    async hexists(key, field) {
        const exists = await this.raw.hExists(key, field);
        return exists ? 1 : 0;
    }
    // ---------------------------------------------------------------
    // String commands
    // ---------------------------------------------------------------
    async get(key) {
        var _a;
        return (_a = (await this.raw.get(key))) !== null && _a !== void 0 ? _a : null;
    }
    async set(key, value, options) {
        const opts = {};
        if ((options === null || options === void 0 ? void 0 : options.PX) != null) {
            opts.PX = options.PX;
        }
        else if ((options === null || options === void 0 ? void 0 : options.EX) != null) {
            opts.EX = options.EX;
        }
        return await this.raw.set(key, String(value), opts);
    }
    async del(...keys) {
        if (keys.length === 0) {
            return 0;
        }
        return await this.raw.del(keys);
    }
    // ---------------------------------------------------------------
    // Sorted set commands
    // ---------------------------------------------------------------
    async zrange(key, start, end, options) {
        if (options === null || options === void 0 ? void 0 : options.WITHSCORES) {
            // node-redis v5 uses a separate method for WITHSCORES
            const items = await this.raw.zRangeWithScores(key, start, end);
            // Flatten to [member, score, member, score, …] like ioredis
            const flat = [];
            for (const item of items) {
                flat.push(item.value, String(item.score));
            }
            return flat;
        }
        return await this.raw.zRange(key, start, end);
    }
    async zrevrange(key, start, end, options) {
        if (options === null || options === void 0 ? void 0 : options.WITHSCORES) {
            const items = await this.raw.zRangeWithScores(key, start, end, {
                REV: true,
            });
            const flat = [];
            for (const item of items) {
                flat.push(item.value, String(item.score));
            }
            return flat;
        }
        return await this.raw.zRange(key, start, end, { REV: true });
    }
    async zcard(key) {
        return await this.raw.zCard(key);
    }
    async zscore(key, member) {
        const score = await this.raw.zScore(key, member);
        return score != null ? String(score) : null;
    }
    // ---------------------------------------------------------------
    // List commands
    // ---------------------------------------------------------------
    async lrange(key, start, end) {
        return await this.raw.lRange(key, start, end);
    }
    async llen(key) {
        return await this.raw.lLen(key);
    }
    async ltrim(key, start, end) {
        await this.raw.lTrim(key, start, end);
        return 'OK';
    }
    async lpos(key, value) {
        var _a;
        return (_a = (await this.raw.lPos(key, value))) !== null && _a !== void 0 ? _a : null;
    }
    // ---------------------------------------------------------------
    // Set commands
    // ---------------------------------------------------------------
    async smembers(key) {
        return await this.raw.sMembers(key);
    }
    // ---------------------------------------------------------------
    // Stream commands
    // ---------------------------------------------------------------
    async xadd(key, id, fields, options) {
        const opts = {};
        if ((options === null || options === void 0 ? void 0 : options.MAXLEN) != null) {
            opts.TRIM = {
                strategy: 'MAXLEN',
                threshold: options.MAXLEN,
                strategyModifier: options.approximate === false ? undefined : '~',
            };
        }
        // node-redis xAdd rejects numeric field values — stringify all values
        const strFields = {};
        for (const [k, v] of Object.entries(fields)) {
            strFields[k] = String(v);
        }
        return await this.raw.xAdd(key, id, strFields, opts);
    }
    async xread(streams, options) {
        const opts = {};
        if ((options === null || options === void 0 ? void 0 : options.BLOCK) != null) {
            opts.BLOCK = options.BLOCK;
        }
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            opts.COUNT = options.COUNT;
        }
        const streamArgs = streams.map(s => ({ key: s.key, id: s.id }));
        let result;
        try {
            result = await this.raw.xRead(streamArgs, opts);
        }
        catch (err) {
            if (this.destroying && isConnectionClosedError(err)) {
                return null;
            }
            if (isConnectionClosedError(err)) {
                throw new connection_closed_error_1.ConnectionClosedError(err.message, err);
            }
            throw err;
        }
        if (!result) {
            return null;
        }
        // Normalize to ioredis format: [[streamName, [[id, [field, value, …]], …]], …]
        return result.map((stream) => [
            stream.name,
            stream.messages.map((msg) => [
                msg.id,
                Object.entries(msg.message).flat(),
            ]),
        ]);
    }
    async xtrim(key, strategy, threshold, options) {
        const strategyModifier = (options === null || options === void 0 ? void 0 : options.approximate) === false ? undefined : '~';
        return await this.raw.xTrim(key, strategy, threshold, {
            strategyModifier,
        });
    }
    // ---------------------------------------------------------------
    // Blocking commands
    // ---------------------------------------------------------------
    async bzpopmin(key, timeout) {
        let result;
        try {
            result = await this.raw.bzPopMin(key, timeout);
        }
        catch (err) {
            if (this.destroying && isConnectionClosedError(err)) {
                return null;
            }
            if (isConnectionClosedError(err)) {
                throw new connection_closed_error_1.ConnectionClosedError(err.message, err);
            }
            throw err;
        }
        if (!result) {
            return null;
        }
        return [result.key, result.value, String(result.score)];
    }
    // ---------------------------------------------------------------
    // Server / admin commands
    // ---------------------------------------------------------------
    async info() {
        return await this.raw.info();
    }
    async clientSetName(name) {
        return await this.raw.clientSetName(name);
    }
    async clientList() {
        return await this.raw.sendCommand(['CLIENT', 'LIST']);
    }
    // ---------------------------------------------------------------
    // Key scanning
    // ---------------------------------------------------------------
    async scan(cursor, options) {
        const opts = {};
        if (options === null || options === void 0 ? void 0 : options.MATCH) {
            opts.MATCH = options.MATCH;
        }
        if (options === null || options === void 0 ? void 0 : options.COUNT) {
            opts.COUNT = options.COUNT;
        }
        const result = await this.raw.scan(String(cursor), opts);
        return [String(result.cursor), result.keys];
    }
    scanStream(options) {
        const raw = this.raw;
        const connectPromise = this.connectPromise;
        const scanOpts = {};
        if (options.match) {
            scanOpts.MATCH = options.match;
        }
        if (options.count) {
            scanOpts.COUNT = options.count;
        }
        const readable = new stream_1.Readable({
            objectMode: true,
            async read() {
                var _a, e_1, _b, _c;
                try {
                    if (connectPromise) {
                        await connectPromise;
                    }
                    try {
                        for (var _d = true, _e = tslib_1.__asyncValues(raw.scanIterator(scanOpts)), _f; _f = await _e.next(), _a = _f.done, !_a; _d = true) {
                            _c = _f.value;
                            _d = false;
                            const keys = _c;
                            if (!readable.push(Array.isArray(keys) ? keys : [keys])) {
                                return; // backpressure
                            }
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    readable.push(null); // EOF
                }
                catch (err) {
                    readable.destroy(err);
                }
            },
        });
        return readable;
    }
    // ---------------------------------------------------------------
    // Extra Redis commands (not part of IRedisClient but used by tests
    // and occasionally by user code that accesses the raw client).
    // ---------------------------------------------------------------
    async keys(pattern) {
        return await this.raw.keys(pattern);
    }
    async exists(...keys) {
        if (keys.length === 0) {
            return 0;
        }
        return await this.raw.exists(keys);
    }
    async zadd(key, ...args) {
        // ioredis: zadd(key, score, member, score, member, ...)
        const members = [];
        for (let i = 0; i < args.length; i += 2) {
            members.push({ score: Number(args[i]), value: String(args[i + 1]) });
        }
        return await this.raw.zAdd(key, members);
    }
    async zrem(key, ...members) {
        return await this.raw.zRem(key, members);
    }
    async xlen(key) {
        return await this.raw.xLen(key);
    }
    async xrevrange(key, end, start, ...rest) {
        const opts = {};
        // ioredis: xrevrange(key, end, start, 'COUNT', n)
        if (rest[0] === 'COUNT') {
            opts.COUNT = Number(rest[1]);
        }
        const result = await this.raw.xRevRange(key, end, start, opts);
        // Normalize to ioredis format: [[id, [field, value, …]], …]
        return result.map((msg) => [
            msg.id,
            Object.entries(msg.message).flat(),
        ]);
    }
    async sadd(key, ...members) {
        return await this.raw.sAdd(key, members.map(String));
    }
    async scard(key) {
        return await this.raw.sCard(key);
    }
    async lpush(key, ...values) {
        return await this.raw.lPush(key, values);
    }
    async rpop(key) {
        return await this.raw.rPop(key);
    }
    async incr(key) {
        return await this.raw.incr(key);
    }
    async incrby(key, increment) {
        return await this.raw.incrBy(key, increment);
    }
    async flushall() {
        return await this.raw.flushAll();
    }
}
// ---------------------------------------------------------------------------
// Transaction / Pipeline wrapper
// ---------------------------------------------------------------------------
class NodeRedisTransaction {
    constructor(raw, scripts) {
        this.raw = raw;
        this.scripts = scripts;
        this.transformers = [];
    }
    addIdentityTransformer() {
        this.transformers.push((v) => v);
    }
    hgetall(key) {
        this.raw.hGetAll(key);
        this.addIdentityTransformer();
        return this;
    }
    hset(key, data) {
        this.raw.hSet(key, data);
        this.addIdentityTransformer();
        return this;
    }
    hscan(key, cursor, options) {
        const opts = {};
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            opts.COUNT = options.COUNT;
        }
        this.raw.hScan(key, String(cursor), opts);
        // Transform node-redis { cursor, entries: [{field, value}] }
        // to ioredis [cursor, [field, value, field, value, ...]]
        this.transformers.push((val) => {
            if (!val) {
                return ['0', []];
            }
            const flat = [];
            for (const entry of val.entries || []) {
                flat.push(entry.field, entry.value);
            }
            return [String(val.cursor), flat];
        });
        return this;
    }
    smembers(key) {
        this.raw.sMembers(key);
        this.addIdentityTransformer();
        return this;
    }
    sscan(key, cursor, options) {
        const opts = {};
        if ((options === null || options === void 0 ? void 0 : options.COUNT) != null) {
            opts.COUNT = options.COUNT;
        }
        this.raw.sScan(key, String(cursor), opts);
        // Transform node-redis { cursor, members: [...] }
        // to ioredis [cursor, [member, member, ...]]
        this.transformers.push((val) => {
            if (!val) {
                return ['0', []];
            }
            return [String(val.cursor), val.members || []];
        });
        return this;
    }
    zrange(key, start, end) {
        this.raw.zRange(key, start, end);
        this.addIdentityTransformer();
        return this;
    }
    lrange(key, start, end) {
        this.raw.lRange(key, start, end);
        this.addIdentityTransformer();
        return this;
    }
    llen(key) {
        this.raw.lLen(key);
        this.addIdentityTransformer();
        return this;
    }
    del(...keys) {
        if (keys.length > 0) {
            this.raw.del(keys);
            this.addIdentityTransformer();
        }
        return this;
    }
    runCommand(name, args) {
        const script = this.scripts.get(name);
        if (!script) {
            throw new Error(`BullMQ: unknown command "${name}" in transaction`);
        }
        const commandArgs = normalizeScriptArgs(args);
        const { sha, lua, numberOfKeys } = script;
        const cmdKeys = commandArgs.slice(0, numberOfKeys).map(String);
        const argv = commandArgs.slice(numberOfKeys).map((a) => {
            if (Buffer.isBuffer(a)) {
                return a;
            }
            if (a === undefined || a === null) {
                return '';
            }
            return String(a);
        });
        // Use evalSha in pipeline; NOSCRIPT handling happens at exec()-time
        // node-redis multi supports evalSha
        this.raw.evalSha(sha, { keys: cmdKeys, arguments: argv });
        this.addIdentityTransformer();
        return this;
    }
    async exec() {
        const results = await this.raw.exec();
        if (!results) {
            return null;
        }
        // node-redis multi.exec() returns values directly (or throws on error).
        // Normalize to ioredis format: [Error | null, value][]
        // Apply per-command transformers for format differences (hscan, sscan).
        return results.map((result, i) => {
            if (result instanceof Error) {
                return [result, null];
            }
            const transformer = this.transformers[i];
            const value = transformer ? transformer(result) : result;
            return [null, value];
        });
    }
}
