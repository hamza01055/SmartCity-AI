import { __rest } from "tslib";
import { EventEmitter } from 'events';
import { default as IORedis } from 'ioredis';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { CONNECTION_CLOSED_ERROR_MSG } from 'ioredis/built/utils';
import { decreaseMaxListeners, increaseMaxListeners, isNotConnectionError, isRedisCluster, isRedisInstance, isRedisVersionLowerThan, } from '../utils';
import { version as packageVersion } from '../version';
import * as scripts from '../scripts';
import { createIORedisClient, isIRedisClient } from './ioredis-client';
import { ConnectionClosedError } from './errors/connection-closed-error';
const overrideMessage = [
    'BullMQ: WARNING! Your redis options maxRetriesPerRequest must be null',
    'and will be overridden by BullMQ.',
].join(' ');
const deprecationMessage = 'BullMQ: Your redis options maxRetriesPerRequest must be null.';
const clusterReconnectPromise = Symbol('bullmqClusterReconnectPromise');
const clusterPatchedForBlocking = Symbol('bullmqClusterPatchedForBlocking');
const clusterOriginalBzpopmin = Symbol('bullmqClusterOriginalBzpopmin');
const clusterWrappedBzpopmin = Symbol('bullmqClusterWrappedBzpopmin');
const clusterPatchRefCount = Symbol('bullmqClusterPatchRefCount');
const clusterClosingRefCount = Symbol('bullmqClusterClosingRefCount');
// Hard cap on a single cluster reconnect attempt. Without this, a hung
// `client.connect()` (e.g. ioredis Cluster cannot recover and slot refresh
// keeps retrying internally) leaves `clusterReconnectPromise` pinned forever
// and every subsequent bzpopmin call awaits the same dead promise, deadlocking
// the worker. 30s is comfortably above the default ioredis slotsRefreshTimeout
// while bounded enough that wedged workers recover within one or two ticks.
const DEFAULT_CLUSTER_RECONNECT_TIMEOUT_MS = 30000;
export class RedisConnection extends EventEmitter {
    constructor(opts, extraOptions) {
        super();
        this.extraOptions = extraOptions;
        this.capabilities = {
            canDoubleTimeout: false,
            canBlockFor1Ms: true,
        };
        this.status = 'initializing';
        this.dbType = 'redis';
        this.packageVersion = packageVersion;
        this.disabledBlockingClusterReconnect = false;
        // Set extra options defaults
        this.extraOptions = Object.assign({ shared: false, blocking: true, skipVersionCheck: false, skipWaitingForReady: false, clusterReconnectTimeoutMs: DEFAULT_CLUSTER_RECONNECT_TIMEOUT_MS }, extraOptions);
        if (!isRedisInstance(opts)) {
            this.checkBlockingOptions(overrideMessage, opts);
            this.opts = Object.assign({ port: 6379, host: '127.0.0.1', retryStrategy: function (times) {
                    return Math.max(Math.min(Math.exp(times), 20000), 1000);
                } }, opts);
            if (this.extraOptions.blocking) {
                this.opts.maxRetriesPerRequest = null;
            }
        }
        else {
            // Wrap raw ioredis instances in the IRedisClient adapter if not already wrapped
            this._client = isIRedisClient(opts)
                ? opts
                : createIORedisClient(opts);
            // Test if the redis instance is using keyPrefix
            // and if so, throw an error.
            if (this._client.options.keyPrefix) {
                throw new Error('BullMQ: ioredis does not support ioredis prefixes, use the prefix option instead.');
            }
            if (this._client.isCluster) {
                this.opts = this._client.options.redisOptions;
            }
            else {
                this.opts = this._client.options;
            }
            this.checkBlockingOptions(deprecationMessage, this.opts, true);
        }
        this.skipVersionCheck =
            (extraOptions === null || extraOptions === void 0 ? void 0 : extraOptions.skipVersionCheck) ||
                !!(this.opts && this.opts.skipVersionCheck);
        this.handleClientError = (err) => {
            this.emit('error', err);
        };
        this.handleClientClose = () => {
            this.emit('close');
        };
        this.handleClientReady = () => {
            this.emit('ready');
        };
        this.initializing = this.init();
        this.initializing.catch(err => this.emit('error', err));
    }
    checkBlockingOptions(msg, options, throwError = false) {
        if (this.extraOptions.blocking && options && options.maxRetriesPerRequest) {
            if (throwError) {
                throw new Error(msg);
            }
            else {
                console.error(msg);
            }
        }
    }
    /**
     * Waits for a redis client to be ready.
     * @param redis - client
     */
    static async waitUntilReady(client) {
        if (client.status === 'ready') {
            return;
        }
        // ioredis Cluster reports 'connect' as its connected status instead of
        // 'ready' that standalone Redis uses. Treat it as already connected so we
        // don't hang waiting for a 'ready' event that will never fire and end up
        // throwing a spurious "Connection is closed" error during disconnect.
        if (client.status === 'connect' && isRedisCluster(client)) {
            return;
        }
        if (client.status === 'wait') {
            return client.connect();
        }
        if (client.status === 'end') {
            throw new ConnectionClosedError(CONNECTION_CLOSED_ERROR_MSG);
        }
        let handleReady;
        let handleEnd;
        let handleError;
        try {
            await new Promise((resolve, reject) => {
                let lastError;
                handleError = (err) => {
                    lastError = err;
                };
                handleReady = () => {
                    resolve();
                };
                handleEnd = () => {
                    if (client.status !== 'end') {
                        reject(lastError ||
                            new ConnectionClosedError(CONNECTION_CLOSED_ERROR_MSG));
                    }
                    else {
                        if (lastError) {
                            reject(lastError);
                        }
                        else {
                            // when custom 'end' status is set we already closed
                            resolve();
                        }
                    }
                };
                increaseMaxListeners(client, 3);
                client.once('ready', handleReady);
                client.on('end', handleEnd);
                client.once('error', handleError);
            });
        }
        finally {
            client.removeListener('end', handleEnd);
            client.removeListener('error', handleError);
            client.removeListener('ready', handleReady);
            decreaseMaxListeners(client, 3);
        }
    }
    get client() {
        return this.initializing;
    }
    loadCommands(packageVersion, providedScripts) {
        const finalScripts = providedScripts || scripts;
        for (const property in finalScripts) {
            // Only define the command if not already defined
            const commandName = `${finalScripts[property].name}:${packageVersion}`;
            if (!this._client[commandName]) {
                this._client.defineCommand(commandName, {
                    numberOfKeys: finalScripts[property].keys,
                    lua: finalScripts[property].content,
                });
            }
        }
    }
    async init() {
        if (!this._client) {
            if (RedisConnection.clientFactory) {
                this._client = RedisConnection.clientFactory(this.opts);
            }
            else {
                const _a = this.opts, { url } = _a, rest = __rest(_a, ["url"]);
                const ioredisClient = url ? new IORedis(url, rest) : new IORedis(rest);
                this._client = createIORedisClient(ioredisClient);
            }
        }
        increaseMaxListeners(this._client, 3);
        this._client.on('error', this.handleClientError);
        // ioredis treats connection errors as a different event ('close')
        this._client.on('close', this.handleClientClose);
        this._client.on('ready', this.handleClientReady);
        this.patchBlockingClusterClient();
        if (!this.extraOptions.skipWaitingForReady) {
            await RedisConnection.waitUntilReady(this._client);
        }
        this.loadCommands(this.packageVersion);
        if (this._client['status'] !== 'end') {
            const versionResult = await this.getRedisVersionAndType();
            this.version = versionResult.version;
            this.dbType = versionResult.databaseType;
            if (this.skipVersionCheck !== true && !this.closing) {
                if (isRedisVersionLowerThan(this.version, RedisConnection.minimumVersion, this.dbType)) {
                    throw new Error(`Redis version needs to be greater or equal than ${RedisConnection.minimumVersion} ` +
                        `Current: ${this.version}`);
                }
                if (isRedisVersionLowerThan(this.version, RedisConnection.recommendedMinimumVersion, this.dbType)) {
                    console.warn(`It is highly recommended to use a minimum Redis version of ${RedisConnection.recommendedMinimumVersion}
             Current: ${this.version}`);
                }
            }
            this.capabilities = {
                canDoubleTimeout: !isRedisVersionLowerThan(this.version, '6.0.0', this.dbType),
                canBlockFor1Ms: !isRedisVersionLowerThan(this.version, '7.0.8', this.dbType),
            };
            this.status = 'ready';
        }
        return this._client;
    }
    patchBlockingClusterClient() {
        var _a;
        const client = this._client;
        const blockingClient = client;
        if (!this.extraOptions.blocking ||
            !isRedisCluster(client) ||
            typeof blockingClient.bzpopmin !== 'function') {
            return;
        }
        const reconnectTimeoutMs = (_a = this.extraOptions.clusterReconnectTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_CLUSTER_RECONNECT_TIMEOUT_MS;
        blockingClient[clusterPatchRefCount] =
            (blockingClient[clusterPatchRefCount] || 0) + 1;
        this.patchedBlockingClusterClient = blockingClient;
        if (blockingClient[clusterPatchedForBlocking]) {
            return;
        }
        const bzpopmin = blockingClient.bzpopmin;
        const wrappedBzpopmin = async (...args) => {
            await RedisConnection.reconnectClusterIfNeeded(blockingClient, reconnectTimeoutMs);
            try {
                return await bzpopmin.apply(blockingClient, args);
            }
            catch (error) {
                const commandError = error;
                if (RedisConnection.shouldReconnectClusterAfterError(blockingClient, commandError)) {
                    try {
                        await RedisConnection.reconnectCluster(blockingClient, reconnectTimeoutMs);
                    }
                    catch (_a) {
                        // Preserve the original command failure if best-effort recovery fails.
                    }
                }
                throw commandError;
            }
        };
        blockingClient[clusterOriginalBzpopmin] = bzpopmin;
        blockingClient[clusterWrappedBzpopmin] = wrappedBzpopmin;
        blockingClient[clusterPatchedForBlocking] = true;
        blockingClient.bzpopmin = wrappedBzpopmin;
    }
    disableBlockingClusterReconnect() {
        const client = this.patchedBlockingClusterClient;
        if (!client || this.disabledBlockingClusterReconnect) {
            return;
        }
        client[clusterClosingRefCount] = (client[clusterClosingRefCount] || 0) + 1;
        this.disabledBlockingClusterReconnect = true;
    }
    releaseBlockingClusterClientPatch() {
        const client = this.patchedBlockingClusterClient;
        if (!client) {
            return;
        }
        if (this.disabledBlockingClusterReconnect) {
            const closingRefCount = (client[clusterClosingRefCount] || 1) - 1;
            if (closingRefCount > 0) {
                client[clusterClosingRefCount] = closingRefCount;
            }
            else {
                delete client[clusterClosingRefCount];
            }
            this.disabledBlockingClusterReconnect = false;
        }
        const patchRefCount = (client[clusterPatchRefCount] || 1) - 1;
        if (patchRefCount > 0) {
            client[clusterPatchRefCount] = patchRefCount;
            this.patchedBlockingClusterClient = undefined;
            return;
        }
        if (client[clusterOriginalBzpopmin] &&
            client.bzpopmin === client[clusterWrappedBzpopmin]) {
            client.bzpopmin = client[clusterOriginalBzpopmin];
        }
        delete client[clusterPatchRefCount];
        delete client[clusterClosingRefCount];
        delete client[clusterOriginalBzpopmin];
        delete client[clusterWrappedBzpopmin];
        delete client[clusterPatchedForBlocking];
        this.patchedBlockingClusterClient = undefined;
    }
    static isClusterWithEmptyNodes(client) {
        return typeof client.nodes === 'function' && client.nodes().length === 0;
    }
    static isReconnectingDisabled(client) {
        const patchRefCount = client[clusterPatchRefCount] || 0;
        const closingRefCount = client[clusterClosingRefCount] || 0;
        return (patchRefCount === 0 ||
            closingRefCount >= patchRefCount ||
            client.status === 'end' ||
            client.status === 'closing');
    }
    static async reconnectClusterIfNeeded(client, timeoutMs) {
        if (!RedisConnection.isReconnectingDisabled(client) &&
            RedisConnection.isClusterWithEmptyNodes(client)) {
            await RedisConnection.reconnectCluster(client, timeoutMs);
        }
    }
    static shouldReconnectClusterAfterError(client, error) {
        var _a, _b;
        if (RedisConnection.isReconnectingDisabled(client)) {
            return false;
        }
        const message = [
            error.message,
            (_a = error.cause) === null || _a === void 0 ? void 0 : _a.message,
            (_b = error.lastNodeError) === null || _b === void 0 ? void 0 : _b.message,
        ].join(' ');
        return (RedisConnection.isClusterWithEmptyNodes(client) ||
            /Command timed out|Failed to refresh slots cache/i.test(message));
    }
    static async reconnectCluster(client, timeoutMs) {
        if (RedisConnection.isReconnectingDisabled(client)) {
            return;
        }
        if (!client[clusterReconnectPromise]) {
            client[clusterReconnectPromise] =
                RedisConnection.connectClusterWithTimeout(client, timeoutMs).finally(() => {
                    client[clusterReconnectPromise] = null;
                });
        }
        await client[clusterReconnectPromise];
    }
    // Disconnects and reconnects a cluster client, racing connect() against a
    // hard cap so a hung reconnect cannot pin `clusterReconnectPromise`
    // indefinitely. On timeout, the underlying connect() is left running
    // (ioredis Cluster handles its own retry/state); we simply stop awaiting it.
    // The next bzpopmin call's `reconnectClusterIfNeeded` check will trigger a
    // fresh reconnect if the pool is still empty.
    static async connectClusterWithTimeout(client, timeoutMs) {
        client.disconnect(false);
        let timeoutHandle;
        try {
            await Promise.race([
                client.connect(),
                new Promise((_, reject) => {
                    var _a;
                    timeoutHandle = setTimeout(() => {
                        reject(new ConnectionClosedError(`BullMQ: cluster reconnect timed out after ${timeoutMs}ms`));
                    }, timeoutMs);
                    // Don't keep the event loop alive solely for this timer.
                    (_a = timeoutHandle.unref) === null || _a === void 0 ? void 0 : _a.call(timeoutHandle);
                }),
            ]);
        }
        finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
        }
    }
    async disconnect(wait = true) {
        const client = await this.client;
        if (client.status !== 'end') {
            let _resolve, _reject;
            if (!wait) {
                return client.disconnect();
            }
            const disconnecting = new Promise((resolve, reject) => {
                increaseMaxListeners(client, 2);
                client.once('end', resolve);
                client.once('error', reject);
                _resolve = resolve;
                _reject = reject;
            });
            client.disconnect();
            try {
                await disconnecting;
            }
            finally {
                decreaseMaxListeners(client, 2);
                client.removeListener('end', _resolve);
                client.removeListener('error', _reject);
            }
        }
    }
    async reconnect() {
        const client = await this.client;
        return client.connect();
    }
    async close(force = false) {
        var _a;
        if (!this.closing) {
            const status = this.status;
            this.status = 'closing';
            this.closing = true;
            this.disableBlockingClusterReconnect();
            try {
                if (status === 'ready') {
                    // Not sure if we need to wait for this
                    await this.initializing;
                }
                if (!this.extraOptions.shared) {
                    if (status == 'initializing' || force) {
                        // If we have not still connected to Redis, we need to disconnect.
                        this._client.disconnect();
                        // Suppress any rejection from the in-flight init() so it doesn't
                        // become an unhandled rejection after we close the connection.
                        (_a = this.initializing) === null || _a === void 0 ? void 0 : _a.catch(() => { });
                    }
                    else {
                        await this._client.quit();
                    }
                    // As IORedis does not update this status properly, we do it ourselves.
                    this._client['status'] = 'end';
                }
            }
            catch (error) {
                if (isNotConnectionError(error)) {
                    throw error;
                }
            }
            finally {
                this.releaseBlockingClusterClientPatch();
                this._client.off('error', this.handleClientError);
                this._client.off('close', this.handleClientClose);
                this._client.off('ready', this.handleClientReady);
                decreaseMaxListeners(this._client, 3);
                this.removeAllListeners();
                this.status = 'closed';
            }
        }
    }
    async getRedisVersionAndType() {
        if (this.skipVersionCheck) {
            return {
                version: RedisConnection.minimumVersion,
                databaseType: 'redis',
            };
        }
        const doc = await this._client.info();
        const redisPrefix = 'redis_version:';
        const maxMemoryPolicyPrefix = 'maxmemory_policy:';
        const lines = doc.split(/\r?\n/);
        let redisVersion;
        let databaseType = 'redis';
        // Detect database type from server info
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check for Dragonfly
            if (line.includes('dragonfly_version:') ||
                line.includes('server:Dragonfly')) {
                databaseType = 'dragonfly';
                // For Dragonfly, extract version from dragonfly_version field
                if (line.indexOf('dragonfly_version:') === 0) {
                    redisVersion = line.substr('dragonfly_version:'.length);
                }
            }
            // Check for Valkey
            else if (line.includes('valkey_version:') ||
                line.includes('server:Valkey')) {
                databaseType = 'valkey';
                // For Valkey, extract version from valkey_version field
                if (line.indexOf('valkey_version:') === 0) {
                    redisVersion = line.substr('valkey_version:'.length);
                }
            }
            // Standard Redis version detection
            else if (line.indexOf(redisPrefix) === 0) {
                redisVersion = line.substr(redisPrefix.length);
                // Keep Redis as default unless we find evidence of other databases above
                if (databaseType === 'redis') {
                    databaseType = 'redis';
                }
            }
            if (line.indexOf(maxMemoryPolicyPrefix) === 0) {
                const maxMemoryPolicy = line.substr(maxMemoryPolicyPrefix.length);
                if (maxMemoryPolicy !== 'noeviction') {
                    console.warn(`IMPORTANT! Eviction policy is ${maxMemoryPolicy}. It should be "noeviction"`);
                }
            }
        }
        // Fallback version detection if specific database version field wasn't found
        if (!redisVersion) {
            // Try to find any version field as fallback
            for (const line of lines) {
                if (line.includes('version:')) {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        redisVersion = parts[1];
                        break;
                    }
                }
            }
        }
        return {
            version: redisVersion || RedisConnection.minimumVersion,
            databaseType,
        };
    }
    get redisVersion() {
        return this.version;
    }
    get databaseType() {
        return this.dbType;
    }
}
RedisConnection.minimumVersion = '5.0.0';
RedisConnection.recommendedMinimumVersion = '6.2.0';
