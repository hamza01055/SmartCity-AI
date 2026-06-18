"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowProducer = void 0;
const events_1 = require("events");
const utils_1 = require("../utils");
const job_1 = require("./job");
const queue_keys_1 = require("./queue-keys");
const redis_connection_1 = require("./redis-connection");
const enums_1 = require("../enums");
/**
 * This class allows to add jobs with dependencies between them in such
 * a way that it is possible to build complex flows.
 * Note: A flow is a tree-like structure of jobs that depend on each other.
 * Whenever the children of a given parent are completed, the parent
 * will be processed, being able to access the children's result data.
 * All Jobs can be in different queues, either children or parents,
 */
class FlowProducer extends events_1.EventEmitter {
    constructor(opts = { connection: {} }, Connection = redis_connection_1.RedisConnection) {
        super();
        this.opts = opts;
        this.opts = Object.assign({ prefix: 'bull' }, opts);
        this.connection = new Connection(opts.connection, {
            shared: (0, utils_1.isRedisInstance)(opts.connection),
            blocking: false,
            skipVersionCheck: opts.skipVersionCheck,
            skipWaitingForReady: opts.skipWaitingForReady,
        });
        this.connection.on('error', (error) => this.emit('error', error));
        this.connection.on('close', () => {
            if (!this.closing) {
                this.emit('ioredis:close');
            }
        });
        this.queueKeys = new queue_keys_1.QueueKeys(opts.prefix);
        if (opts === null || opts === void 0 ? void 0 : opts.telemetry) {
            this.telemetry = opts.telemetry;
        }
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    off(eventName, listener) {
        super.off(eventName, listener);
        return this;
    }
    on(event, listener) {
        super.on(event, listener);
        return this;
    }
    once(event, listener) {
        super.once(event, listener);
        return this;
    }
    /**
     * Returns a promise that resolves to a redis client. Normally used only by subclasses.
     */
    get client() {
        return this.connection.client;
    }
    /**
     * Helper to easily extend Job class calls.
     */
    get Job() {
        return job_1.Job;
    }
    waitUntilReady() {
        return this.client;
    }
    /**
     * Adds a flow.
     *
     * This call would be atomic, either it fails and no jobs will
     * be added to the queues, or it succeeds and all jobs will be added.
     *
     * @param flow - an object with a tree-like structure where children jobs
     * will be processed before their parents.
     * @param opts - options that will be applied to the flow object.
     */
    async add(flow, opts) {
        var _a;
        if (this.closing) {
            return;
        }
        const client = await this.connection.client;
        const multi = client.multi();
        const parentOpts = (_a = flow === null || flow === void 0 ? void 0 : flow.opts) === null || _a === void 0 ? void 0 : _a.parent;
        const parentKey = (0, utils_1.getParentKey)(parentOpts);
        const parentDependenciesKey = parentKey
            ? `${parentKey}:dependencies`
            : undefined;
        return (0, utils_1.trace)(this.telemetry, enums_1.SpanKind.PRODUCER, flow.queueName, 'addFlow', flow.queueName, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.FlowName]: flow.name,
            });
            const jobsTree = await this.addNode({
                multi,
                node: flow,
                queuesOpts: opts === null || opts === void 0 ? void 0 : opts.queuesOptions,
                parent: {
                    parentOpts,
                    parentDependenciesKey,
                },
            });
            const results = (await multi.exec());
            const [result] = results || [];
            if (result) {
                const [err, jobId] = result;
                if (err) {
                    throw err;
                }
                if (typeof jobId === 'number' && jobId < 0) {
                    throw this.toFlowError(jobId, parentKey);
                }
                if (typeof jobId === 'string') {
                    jobsTree.job.id = jobId;
                }
            }
            return jobsTree;
        });
    }
    /**
     * Get a flow.
     *
     * @param opts - an object with options for getting a JobNode.
     */
    async getFlow(opts) {
        if (this.closing) {
            return;
        }
        const client = await this.connection.client;
        const updatedOpts = Object.assign({
            depth: 10,
            maxChildren: 20,
            prefix: this.opts.prefix,
        }, opts);
        const jobsTree = this.getNode(client, updatedOpts);
        return jobsTree;
    }
    /**
     * Adds multiple flows.
     *
     * A flow is a tree-like structure of jobs that depend on each other.
     * Whenever the children of a given parent are completed, the parent
     * will be processed, being able to access the children's result data.
     *
     * All Jobs can be in different queues, either children or parents,
     * however this call would be atomic, either it fails and no jobs will
     * be added to the queues, or it succeeds and all jobs will be added.
     *
     * @param flows - an array of objects with a tree-like structure where children jobs
     * will be processed before their parents.
     */
    async addBulk(flows) {
        if (this.closing) {
            return;
        }
        const client = await this.connection.client;
        const multi = client.multi();
        return (0, utils_1.trace)(this.telemetry, enums_1.SpanKind.PRODUCER, '', 'addBulkFlows', '', async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.BulkCount]: flows.length,
                [enums_1.TelemetryAttributes.BulkNames]: flows
                    .map(flow => flow.name)
                    .join(','),
            });
            const jobsTrees = await this.addNodes(multi, flows);
            const results = (await multi.exec());
            for (let index = 0; index < jobsTrees.length; ++index) {
                const result = results === null || results === void 0 ? void 0 : results[index];
                if (!result) {
                    continue;
                }
                const [err, jobId] = result;
                if (!err && typeof jobId === 'string') {
                    jobsTrees[index].job.id = jobId;
                }
            }
            return jobsTrees;
        });
    }
    /**
     * Add a node (job) of a flow to the queue. This method will recursively
     * add all its children as well. Note that a given job can potentially be
     * a parent and a child job at the same time depending on where it is located
     * in the tree hierarchy.
     *
     * @param multi - IRedisTransaction
     * @param node - the node representing a job to be added to some queue
     * @param parent - parent data sent to children to create the "links" to their parent
     * @returns
     */
    async addNode({ multi, node, parent, queuesOpts, }) {
        var _a, _b;
        const prefix = node.prefix || this.opts.prefix;
        const queue = this.queueFromNode(node, new queue_keys_1.QueueKeys(prefix), prefix);
        const queueOpts = queuesOpts && queuesOpts[node.queueName];
        const jobsOpts = (_a = queueOpts === null || queueOpts === void 0 ? void 0 : queueOpts.defaultJobOptions) !== null && _a !== void 0 ? _a : {};
        const jobId = ((_b = node.opts) === null || _b === void 0 ? void 0 : _b.jobId) || (0, utils_1.randomUUID)();
        return (0, utils_1.trace)(this.telemetry, enums_1.SpanKind.PRODUCER, node.queueName, 'addNode', node.queueName, async (span, srcPropagationMetadata) => {
            var _a, _b;
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobName]: node.name,
                [enums_1.TelemetryAttributes.JobId]: jobId,
            });
            const opts = node.opts;
            let telemetry = opts === null || opts === void 0 ? void 0 : opts.telemetry;
            if (srcPropagationMetadata && opts) {
                const omitContext = (_a = opts.telemetry) === null || _a === void 0 ? void 0 : _a.omitContext;
                const telemetryMetadata = ((_b = opts.telemetry) === null || _b === void 0 ? void 0 : _b.metadata) ||
                    (!omitContext && srcPropagationMetadata);
                if (telemetryMetadata || omitContext) {
                    telemetry = {
                        metadata: telemetryMetadata,
                        omitContext,
                    };
                }
            }
            const job = new this.Job(queue, node.name, node.data, Object.assign(Object.assign(Object.assign({}, jobsOpts), opts), { parent: parent === null || parent === void 0 ? void 0 : parent.parentOpts, telemetry }), jobId);
            const parentKey = (0, utils_1.getParentKey)(parent === null || parent === void 0 ? void 0 : parent.parentOpts);
            if (node.children && node.children.length > 0) {
                // Create the parent job, it will be a job in status "waiting-children".
                const parentId = jobId;
                const queueKeysParent = new queue_keys_1.QueueKeys(node.prefix || this.opts.prefix);
                await job.addJob(multi, {
                    parentDependenciesKey: parent === null || parent === void 0 ? void 0 : parent.parentDependenciesKey,
                    addToWaitingChildren: true,
                    parentKey,
                });
                const parentDependenciesKey = `${queueKeysParent.toKey(node.queueName, parentId)}:dependencies`;
                const children = await this.addChildren({
                    multi,
                    nodes: node.children,
                    parent: {
                        parentOpts: {
                            id: parentId,
                            queue: queueKeysParent.getQueueQualifiedName(node.queueName),
                        },
                        parentDependenciesKey,
                    },
                    queuesOpts,
                });
                return { job, children };
            }
            else {
                await job.addJob(multi, {
                    parentDependenciesKey: parent === null || parent === void 0 ? void 0 : parent.parentDependenciesKey,
                    parentKey,
                });
                return { job };
            }
        });
    }
    /**
     * Adds nodes (jobs) of multiple flows to the queue. This method will recursively
     * add all its children as well. Note that a given job can potentially be
     * a parent and a child job at the same time depending on where it is located
     * in the tree hierarchy.
     *
     * @param multi - IRedisTransaction
     * @param nodes - the nodes representing jobs to be added to some queue
     * @returns
     */
    addNodes(multi, nodes) {
        return Promise.all(nodes.map(node => {
            var _a;
            const parentOpts = (_a = node === null || node === void 0 ? void 0 : node.opts) === null || _a === void 0 ? void 0 : _a.parent;
            const parentKey = (0, utils_1.getParentKey)(parentOpts);
            const parentDependenciesKey = parentKey
                ? `${parentKey}:dependencies`
                : undefined;
            return this.addNode({
                multi,
                node,
                parent: {
                    parentOpts,
                    parentDependenciesKey,
                },
            });
        }));
    }
    async getNode(client, node) {
        const queue = this.queueFromNode(node, new queue_keys_1.QueueKeys(node.prefix), node.prefix);
        const job = await this.Job.fromId(queue, node.id);
        if (job) {
            const { processed = {}, unprocessed = [], failed = [], ignored = {}, } = await job.getDependencies({
                failed: {
                    count: node.maxChildren,
                },
                processed: {
                    count: node.maxChildren,
                },
                unprocessed: {
                    count: node.maxChildren,
                },
                ignored: {
                    count: node.maxChildren,
                },
            });
            const processedKeys = Object.keys(processed);
            const ignoredKeys = Object.keys(ignored);
            const childrenCount = processedKeys.length +
                unprocessed.length +
                ignoredKeys.length +
                failed.length;
            const newDepth = node.depth - 1;
            if (childrenCount > 0 && newDepth) {
                const children = await this.getChildren(client, [...processedKeys, ...unprocessed, ...failed, ...ignoredKeys], newDepth, node.maxChildren);
                return { job, children };
            }
            else {
                return { job };
            }
        }
    }
    addChildren({ multi, nodes, parent, queuesOpts }) {
        return Promise.all(nodes.map(node => this.addNode({ multi, node, parent, queuesOpts })));
    }
    getChildren(client, childrenKeys, depth, maxChildren) {
        const getChild = (key) => {
            const [prefix, queueName, id] = key.split(':');
            return this.getNode(client, {
                id,
                queueName,
                prefix,
                depth,
                maxChildren,
            });
        };
        return Promise.all([...childrenKeys.map(getChild)]);
    }
    /**
     * Helper factory method that creates a queue-like object
     * required to create jobs in any queue.
     *
     * @param node - The flow node containing the queue name and other job options.
     * @param queueKeys - The queue keys helper used to resolve key names.
     * @param prefix - The Redis key prefix used for the queue.
     * @returns A queue-like object with the client, keys, and options needed to create jobs.
     */
    queueFromNode(node, queueKeys, prefix) {
        return {
            client: this.connection.client,
            name: node.queueName,
            keys: queueKeys.getKeys(node.queueName),
            toKey: (type) => queueKeys.toKey(node.queueName, type),
            opts: { prefix, connection: {} },
            qualifiedName: queueKeys.getQueueQualifiedName(node.queueName),
            closing: this.closing,
            waitUntilReady: async () => this.connection.client,
            removeListener: this.removeListener.bind(this),
            emit: this.emit.bind(this),
            on: this.on.bind(this),
            redisVersion: this.connection.redisVersion,
            databaseType: this.connection.databaseType,
            trace: async () => { },
        };
    }
    /**
     * Translates numeric addJob Lua error codes returned by root flow exec.
     *
     * @param code - Numeric error code returned from Redis.
     * @param parentKey - Parent key for contextual error messages.
     */
    toFlowError(code, parentKey) {
        let error;
        switch (code) {
            case enums_1.ErrorCode.ParentJobNotExist:
                error = new Error(`Missing key for parent job ${parentKey}. addJob`);
                break;
            case enums_1.ErrorCode.ParentJobCannotBeReplaced:
                error = new Error(`The parent job ${parentKey} cannot be replaced. addJob`);
                break;
            default:
                error = new Error(`Unknown code ${code} error for addJob`);
        }
        error.code = code;
        return error;
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
    }
    /**
     *
     * Force disconnects a connection.
     */
    disconnect() {
        return this.connection.disconnect();
    }
}
exports.FlowProducer = FlowProducer;
