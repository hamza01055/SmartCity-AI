"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
const fs = require("fs");
const url_1 = require("url");
const path = require("path");
const abort_controller_1 = require("./abort-controller");
const utils_1 = require("../utils");
const queue_base_1 = require("./queue-base");
const repeat_1 = require("./repeat");
const child_pool_1 = require("./child-pool");
const redis_connection_1 = require("./redis-connection");
const ioredis_client_1 = require("./ioredis-client");
const sandbox_1 = require("./sandbox");
const async_fifo_queue_1 = require("./async-fifo-queue");
const errors_1 = require("./errors");
const enums_1 = require("../enums");
const job_scheduler_1 = require("./job-scheduler");
const lock_manager_1 = require("./lock-manager");
// 10 seconds is the maximum time a BZPOPMIN can block.
const maximumBlockTimeout = 10;
/**
 *
 * This class represents a worker that is able to process jobs from the queue.
 * As soon as the class is instantiated and a connection to Redis is established
 * it will start processing jobs.
 *
 */
class Worker extends queue_base_1.QueueBase {
    static RateLimitError() {
        return new errors_1.RateLimitError();
    }
    constructor(name, processor, opts, Connection) {
        super(name, Object.assign(Object.assign({ drainDelay: 5, concurrency: 1, lockDuration: 30000, maximumRateLimitDelay: 30000, maxStalledCount: 1, stalledInterval: 30000, autorun: true, runRetryDelay: 15000 }, opts), { blockingConnection: true }), Connection);
        this.abortDelayController = null;
        this.blockUntil = 0;
        this.drained = false;
        this.limitUntil = 0;
        this.processorAcceptsSignal = false;
        this.stalledCheckerRunning = false;
        this.waiting = null;
        this.running = false;
        this.mainLoopRunning = null;
        if (!opts || !opts.connection) {
            throw new Error('Worker requires a connection');
        }
        if (typeof this.opts.maxStalledCount !== 'number' ||
            this.opts.maxStalledCount < 0) {
            throw new Error('maxStalledCount must be greater or equal than 0');
        }
        if (typeof this.opts.maxStartedAttempts === 'number' &&
            this.opts.maxStartedAttempts < 0) {
            throw new Error('maxStartedAttempts must be greater or equal than 0');
        }
        if (typeof this.opts.stalledInterval !== 'number' ||
            this.opts.stalledInterval <= 0) {
            throw new Error('stalledInterval must be greater than 0');
        }
        if (typeof this.opts.drainDelay !== 'number' || this.opts.drainDelay <= 0) {
            throw new Error('drainDelay must be greater than 0');
        }
        this.concurrency = this.opts.concurrency;
        this.opts.lockRenewTime =
            this.opts.lockRenewTime || this.opts.lockDuration / 2;
        this.id = (0, utils_1.randomUUID)();
        this.createLockManager();
        if (processor) {
            if (typeof processor === 'function') {
                this.processFn = processor;
                // Check if processor accepts signal parameter (3rd parameter)
                this.processorAcceptsSignal = processor.length >= 3;
            }
            else {
                // SANDBOXED
                if (processor instanceof url_1.URL) {
                    if (!fs.existsSync(processor)) {
                        throw new Error(`URL ${processor} does not exist in the local file system`);
                    }
                    processor = processor.href;
                }
                else {
                    const supportedFileTypes = ['.js', '.ts', '.flow', '.cjs', '.mjs'];
                    const processorFile = processor +
                        (supportedFileTypes.includes(path.extname(processor)) ? '' : '.js');
                    if (!fs.existsSync(processorFile)) {
                        throw new Error(`File ${processorFile} does not exist`);
                    }
                }
                // Separate paths so that bundling tools can resolve dependencies easier
                const dirname = path.dirname(module.filename || __filename);
                const workerThreadsMainFile = path.join(dirname, 'main-worker.js');
                const spawnProcessMainFile = path.join(dirname, 'main.js');
                let mainFilePath = this.opts.useWorkerThreads
                    ? workerThreadsMainFile
                    : spawnProcessMainFile;
                try {
                    fs.statSync(mainFilePath); // would throw if file not exists
                }
                catch (_) {
                    const mainFile = this.opts.useWorkerThreads
                        ? 'main-worker.js'
                        : 'main.js';
                    mainFilePath = path.join(process.cwd(), `dist/cjs/classes/${mainFile}`);
                    fs.statSync(mainFilePath);
                }
                this.childPool = new child_pool_1.ChildPool({
                    mainFile: mainFilePath,
                    useWorkerThreads: this.opts.useWorkerThreads,
                    workerForkOptions: this.opts.workerForkOptions,
                    workerThreadsOptions: this.opts.workerThreadsOptions,
                });
                this.createSandbox(processor);
                this.processorAcceptsSignal = true;
            }
            if (this.opts.autorun) {
                this.run().catch(error => this.emit('error', error));
            }
        }
        const connectionName = this.clientName() + (this.opts.name ? `:w:${this.opts.name}` : '');
        this.blockingConnection = new redis_connection_1.RedisConnection((0, utils_1.isRedisInstance)(opts.connection)
            ? ((0, ioredis_client_1.isIRedisClient)(opts.connection)
                ? opts.connection
                : (0, ioredis_client_1.createIORedisClient)(opts.connection)).duplicate({ connectionName })
            : Object.assign(Object.assign({}, opts.connection), { connectionName }), {
            shared: false,
            blocking: true,
            skipVersionCheck: opts.skipVersionCheck,
        });
        this.blockingConnection.on('error', error => this.emit('error', error));
        this.blockingConnection.on('ready', () => setTimeout(() => this.emit('ready'), 0));
    }
    /**
     * Creates and configures the lock manager for processing jobs.
     * This method can be overridden in subclasses to customize lock manager behavior.
     */
    createLockManager() {
        this.lockManager = new lock_manager_1.LockManager(this, {
            lockRenewTime: this.opts.lockRenewTime,
            lockDuration: this.opts.lockDuration,
            workerId: this.id,
            workerName: this.opts.name,
        });
    }
    /**
     * Creates and configures the sandbox for processing jobs.
     * This method can be overridden in subclasses to customize sandbox behavior.
     *
     * @param processor - The processor file path, URL, or function to be sandboxed
     */
    createSandbox(processor) {
        this.processFn = (0, sandbox_1.default)(processor, this.childPool).bind(this);
    }
    /**
     * Public accessor method for LockManager to extend locks.
     * This delegates to the protected scripts object.
     */
    async extendJobLocks(jobIds, tokens, duration) {
        return this.scripts.extendLocks(jobIds, tokens, duration);
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
    callProcessJob(job, token, signal) {
        return this.processFn(job, token, signal);
    }
    createJob(data, jobId) {
        return this.Job.fromJSON(this, data, jobId);
    }
    /**
     *
     * Waits until the worker is ready to start processing jobs.
     * In general only useful when writing tests.
     *
     */
    async waitUntilReady() {
        await super.waitUntilReady();
        return this.blockingConnection.client;
    }
    /**
     * Cancels a specific job currently being processed by this worker.
     * The job's processor function will receive an abort signal.
     *
     * @param jobId - The ID of the job to cancel
     * @param reason - Optional reason for the cancellation
     * @returns true if the job was found and cancelled, false otherwise
     */
    cancelJob(jobId, reason) {
        return this.lockManager.cancelJob(jobId, reason);
    }
    /**
     * Cancels all jobs currently being processed by this worker.
     * All active job processor functions will receive abort signals.
     *
     * @param reason - Optional reason for the cancellation
     */
    cancelAllJobs(reason) {
        this.lockManager.cancelAllJobs(reason);
    }
    set concurrency(concurrency) {
        if (typeof concurrency !== 'number' ||
            concurrency < 1 ||
            !isFinite(concurrency)) {
            throw new Error('concurrency must be a finite number greater than 0');
        }
        this._concurrency = concurrency;
    }
    get concurrency() {
        return this._concurrency;
    }
    get repeat() {
        return new Promise(async (resolve) => {
            if (!this._repeat) {
                const connection = await this.client;
                this._repeat = new repeat_1.Repeat(this.name, Object.assign(Object.assign({}, this.opts), { connection }));
                this._repeat.on('error', this.emit.bind(this, 'error'));
            }
            resolve(this._repeat);
        });
    }
    get jobScheduler() {
        return new Promise(async (resolve) => {
            if (!this._jobScheduler) {
                const connection = await this.client;
                this._jobScheduler = new job_scheduler_1.JobScheduler(this.name, Object.assign(Object.assign({}, this.opts), { connection }));
                this._jobScheduler.on('error', this.emit.bind(this, 'error'));
            }
            resolve(this._jobScheduler);
        });
    }
    async run() {
        if (!this.processFn) {
            throw new Error('No process function is defined.');
        }
        if (this.running) {
            throw new Error('Worker is already running.');
        }
        try {
            this.running = true;
            if (this.closing || this.paused) {
                return;
            }
            await this.startStalledCheckTimer();
            if (!this.opts.skipLockRenewal) {
                this.lockManager.start();
            }
            const client = await this.client;
            const bclient = await this.blockingConnection.client;
            this.mainLoopRunning = this.mainLoop(client, bclient);
            // We must await here or finally will be called too early.
            await this.mainLoopRunning;
        }
        finally {
            this.running = false;
        }
    }
    async waitForRateLimit() {
        var _a;
        const limitUntil = this.limitUntil;
        if (limitUntil > Date.now()) {
            (_a = this.abortDelayController) === null || _a === void 0 ? void 0 : _a.abort();
            this.abortDelayController = new abort_controller_1.AbortController();
            const delay = this.getRateLimitDelay(limitUntil - Date.now());
            await this.delay(delay, this.abortDelayController);
            this.drained = false;
            this.limitUntil = 0;
        }
    }
    /**
     * This is the main loop in BullMQ. Its goals are to fetch jobs from the queue
     * as efficiently as possible, providing concurrency and minimal unnecessary calls
     * to Redis.
     */
    async mainLoop(client, bclient) {
        const asyncFifoQueue = new async_fifo_queue_1.AsyncFifoQueue();
        let tokenPostfix = 0;
        while ((!this.closing && !this.paused) || asyncFifoQueue.numTotal() > 0) {
            /**
             * This inner loop tries to fetch jobs concurrently, but if we are waiting for a job
             * to arrive at the queue we should not try to fetch more jobs (as it would be pointless)
             */
            while (!this.closing &&
                !this.paused &&
                !this.waiting &&
                asyncFifoQueue.numTotal() < this._concurrency &&
                !this.isRateLimited()) {
                const token = `${this.id}:${tokenPostfix++}`;
                const fetchedJob = this.retryIfFailed(() => this._getNextJob(client, bclient, token, { block: true }), {
                    delayInMs: this.opts.runRetryDelay,
                    onlyEmitError: true,
                });
                asyncFifoQueue.add(fetchedJob);
                if (this.waiting && asyncFifoQueue.numTotal() > 1) {
                    // We are waiting for jobs but we have others that we could start processing already
                    break;
                }
                // We await here so that we fetch jobs in sequence, this is important to avoid unnecessary calls
                // to Redis in high concurrency scenarios.
                const job = await fetchedJob;
                // No more jobs waiting but we have others that could start processing already
                if (!job && asyncFifoQueue.numTotal() > 1) {
                    break;
                }
                // If there are potential jobs to be processed and blockUntil is set, we should exit to avoid waiting
                // for processing this job.
                if (this.blockUntil) {
                    break;
                }
            }
            // Since there can be undefined jobs in the queue (when a job fails or queue is empty)
            // we iterate until we find a job.
            let job;
            do {
                job = await asyncFifoQueue.fetch();
            } while (!job && asyncFifoQueue.numQueued() > 0);
            if (job) {
                const token = job.token;
                asyncFifoQueue.add(this.processJob(job, token, () => asyncFifoQueue.numTotal() <= this._concurrency));
            }
            else if (asyncFifoQueue.numQueued() === 0) {
                await this.waitForRateLimit();
            }
        }
    }
    /**
     * Returns a promise that resolves to the next job in queue.
     * @param token - worker token to be assigned to retrieved job
     * @returns a Job or undefined if no job was available in the queue.
     */
    async getNextJob(token, { block = true } = {}) {
        var _a, _b;
        const nextJob = await this._getNextJob(await this.client, await this.blockingConnection.client, token, { block });
        return this.trace(enums_1.SpanKind.INTERNAL, 'getNextJob', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.WorkerId]: this.id,
                [enums_1.TelemetryAttributes.QueueName]: this.name,
                [enums_1.TelemetryAttributes.WorkerName]: this.opts.name,
                [enums_1.TelemetryAttributes.WorkerOptions]: JSON.stringify({ block }),
                [enums_1.TelemetryAttributes.JobId]: nextJob === null || nextJob === void 0 ? void 0 : nextJob.id,
            });
            return nextJob;
        }, (_b = (_a = nextJob === null || nextJob === void 0 ? void 0 : nextJob.opts) === null || _a === void 0 ? void 0 : _a.telemetry) === null || _b === void 0 ? void 0 : _b.metadata);
    }
    async _getNextJob(client, bclient, token, { block = true } = {}) {
        if (this.paused) {
            return;
        }
        if (this.closing) {
            return;
        }
        let job;
        if (this.drained && block && !this.limitUntil && !this.waiting) {
            this.waiting = this.waitForJob(bclient, this.blockUntil);
            try {
                this.blockUntil = await this.waiting;
                if (this.blockUntil <= 0 || this.blockUntil - Date.now() < 1) {
                    job = await this.moveToActive(client, token, this.opts.name);
                }
            }
            finally {
                this.waiting = null;
            }
        }
        else {
            if (!this.isRateLimited()) {
                job = await this.moveToActive(client, token, this.opts.name);
            }
        }
        if (job) {
            this.emit('active', job, 'waiting');
        }
        return job;
    }
    /**
     * Overrides the rate limit to be active for the next jobs.
     * @deprecated This method is deprecated and will be removed in v6. Use queue.rateLimit method instead.
     * @param expireTimeMs - expire time in ms of this rate limit.
     */
    async rateLimit(expireTimeMs) {
        await this.trace(enums_1.SpanKind.INTERNAL, 'rateLimit', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.WorkerId]: this.id,
                [enums_1.TelemetryAttributes.WorkerRateLimit]: expireTimeMs,
            });
            await this.client.then(client => client.set(this.keys.limiter, Number.MAX_SAFE_INTEGER, {
                PX: expireTimeMs,
            }));
        });
    }
    get minimumBlockTimeout() {
        return this.blockingConnection.capabilities.canBlockFor1Ms
            ? /* 1 millisecond is chosen because the granularity of our timestamps are milliseconds.
      Obviously we can still process much faster than 1 job per millisecond but delays and rate limits
      will never work with more accuracy than 1ms. */
                0.001
            : 0.002;
    }
    isRateLimited() {
        return this.limitUntil > Date.now();
    }
    async moveToActive(client, token, name) {
        const [jobData, id, rateLimitDelay, delayUntil] = await this.scripts.moveToActive(client, token, name);
        this.updateDelays(rateLimitDelay, delayUntil);
        return this.nextJobFromJobData(jobData, id, token);
    }
    async waitForJob(bclient, blockUntil) {
        if (this.paused) {
            return Infinity;
        }
        let timeout;
        try {
            if (!this.closing && !this.isRateLimited()) {
                let blockTimeout = this.getBlockTimeout(blockUntil);
                if (blockTimeout > 0) {
                    blockTimeout = this.blockingConnection.capabilities.canDoubleTimeout
                        ? blockTimeout
                        : Math.ceil(blockTimeout);
                    // We cannot trust that the blocking connection stays blocking forever
                    // due to issues in Redis and IORedis, so we will reconnect if we
                    // don't get a response in the expected time.
                    timeout = setTimeout(async () => {
                        bclient.disconnect(!this.closing);
                    }, blockTimeout * 1000 + 1000);
                    this.updateDelays(); // reset delays to avoid reusing same values in next iteration
                    // Markers should only be used for un-blocking, so we will handle them in this
                    // function only.
                    const result = await bclient.bzpopmin(this.keys.marker, blockTimeout);
                    if (result) {
                        const [, member, score] = result;
                        if (member) {
                            const newBlockUntil = parseInt(score);
                            // Use by pro version as rate limited groups could generate lower blockUntil values
                            // markers only return delays for delayed jobs
                            if (blockUntil && newBlockUntil > blockUntil) {
                                return blockUntil;
                            }
                            return newBlockUntil;
                        }
                    }
                }
                return 0;
            }
        }
        catch (error) {
            if ((0, utils_1.isNotConnectionError)(error)) {
                this.emit('error', error);
            }
            if (!this.closing) {
                await this.delay();
            }
        }
        finally {
            clearTimeout(timeout);
        }
        return Infinity;
    }
    getBlockTimeout(blockUntil) {
        const opts = this.opts;
        // when there are delayed jobs
        if (blockUntil) {
            const blockDelay = blockUntil - Date.now();
            // when we reach the time to get new jobs
            if (blockDelay <= 0) {
                return blockDelay;
            }
            else if (blockDelay < this.minimumBlockTimeout * 1000) {
                return this.minimumBlockTimeout;
            }
            else {
                // We restrict the maximum block timeout to 10 second to avoid
                // blocking the connection for too long in the case of reconnections
                // reference: https://github.com/taskforcesh/bullmq/issues/1658
                return Math.min(blockDelay / 1000, maximumBlockTimeout);
            }
        }
        else {
            return Math.max(opts.drainDelay, this.minimumBlockTimeout);
        }
    }
    getRateLimitDelay(delay) {
        // We restrict the maximum limit delay to the configured maximumRateLimitDelay
        // to be able to promote delayed jobs while the queue is rate limited
        return Math.min(delay, this.opts.maximumRateLimitDelay);
    }
    /**
     *
     * This function is exposed only for testing purposes.
     */
    async delay(milliseconds, abortController) {
        await (0, utils_1.delay)(milliseconds || utils_1.DELAY_TIME_1, abortController);
    }
    updateDelays(limitDelay = 0, delayUntil = 0) {
        const clampedLimit = Math.max(limitDelay, 0);
        if (clampedLimit > 0) {
            this.limitUntil = Date.now() + clampedLimit;
        }
        else {
            this.limitUntil = 0;
        }
        this.blockUntil = Math.max(delayUntil, 0) || 0;
    }
    async nextJobFromJobData(jobData, jobId, token) {
        if (!jobData) {
            if (!this.drained) {
                this.emit('drained');
                this.drained = true;
            }
        }
        else {
            this.drained = false;
            const job = this.createJob(jobData, jobId);
            job.token = token;
            try {
                await this.retryIfFailed(async () => {
                    // We need to distinguish between new job schedulers and legacy
                    // repeatable jobs. Legacy repeatable keys always contain 5+
                    // colon segments, but a user-provided jobSchedulerId may also
                    // contain 5+ segments, so we cannot rely on the segment count
                    // alone (see issue #3828). When the key has 5+ segments we
                    // probe the per-id scheduler metadata hash (`repeat:<id>` with
                    // the `ic` field) via `JobScheduler.isJobScheduler()` to confirm
                    // it really is a scheduler before falling back to the legacy
                    // repeatable path.
                    const hasRepeatJobKey = !!job.repeatJobKey;
                    const hasLegacyKeyShape = hasRepeatJobKey && job.repeatJobKey.split(':').length >= 5;
                    let isJobScheduler = hasRepeatJobKey && !hasLegacyKeyShape;
                    if (hasLegacyKeyShape) {
                        const jobScheduler = await this.jobScheduler;
                        isJobScheduler = await jobScheduler.isJobScheduler(job.repeatJobKey);
                    }
                    if (isJobScheduler) {
                        const jobScheduler = await this.jobScheduler;
                        await jobScheduler.upsertJobScheduler(
                        // Most of these arguments are not really needed
                        // anymore as we read them from the job scheduler itself
                        job.repeatJobKey, job.opts.repeat, job.name, job.data, job.opts, { override: false, producerId: job.id });
                    }
                    else if (job.opts.repeat) {
                        const repeat = await this.repeat;
                        await repeat.updateRepeatableJob(job.name, job.data, job.opts, {
                            override: false,
                        });
                    }
                }, { delayInMs: this.opts.runRetryDelay });
            }
            catch (err) {
                // Emit error but don't throw to avoid breaking current job completion
                // Note: This means the next repeatable job will not be scheduled
                const errorMessage = err instanceof Error ? err.message : String(err);
                const schedulingError = new Error(`Failed to add repeatable job for next iteration: ${errorMessage}`);
                this.emit('error', schedulingError);
                // Return undefined to indicate no next job is available
                return undefined;
            }
            return job;
        }
    }
    async processJob(job, token, fetchNextCallback = () => true) {
        var _a, _b;
        const srcPropagationMetadata = (_b = (_a = job.opts) === null || _a === void 0 ? void 0 : _a.telemetry) === null || _b === void 0 ? void 0 : _b.metadata;
        return this.trace(enums_1.SpanKind.CONSUMER, 'process', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.WorkerId]: this.id,
                [enums_1.TelemetryAttributes.WorkerName]: this.opts.name,
                [enums_1.TelemetryAttributes.JobId]: job.id,
                [enums_1.TelemetryAttributes.JobName]: job.name,
            });
            const abortController = this.lockManager.trackJob(job.id, token, job.processedOn, this.processorAcceptsSignal);
            try {
                const unrecoverableErrorMessage = this.getUnrecoverableErrorMessage(job);
                if (unrecoverableErrorMessage) {
                    const failed = await this.retryIfFailed(() => {
                        this.lockManager.untrackJob(job.id);
                        return this.handleFailed(new errors_1.UnrecoverableError(unrecoverableErrorMessage), job, token, fetchNextCallback, span);
                    }, { delayInMs: this.opts.runRetryDelay, span });
                    return failed;
                }
                const result = await this.callProcessJob(job, token, abortController
                    ? abortController.signal
                    : undefined);
                return await this.retryIfFailed(() => {
                    this.lockManager.untrackJob(job.id);
                    return this.handleCompleted(result, job, token, fetchNextCallback, span);
                }, { delayInMs: this.opts.runRetryDelay, span });
            }
            catch (err) {
                const failed = await this.retryIfFailed(() => {
                    this.lockManager.untrackJob(job.id);
                    return this.handleFailed(err, job, token, fetchNextCallback, span);
                }, { delayInMs: this.opts.runRetryDelay, span, onlyEmitError: true });
                return failed;
            }
            finally {
                this.lockManager.untrackJob(job.id);
                const now = Date.now();
                span === null || span === void 0 ? void 0 : span.setAttributes({
                    [enums_1.TelemetryAttributes.JobFinishedTimestamp]: now,
                    [enums_1.TelemetryAttributes.JobAttemptFinishedTimestamp]: job.finishedOn || now,
                    [enums_1.TelemetryAttributes.JobProcessedTimestamp]: job.processedOn,
                });
            }
        }, srcPropagationMetadata);
    }
    getUnrecoverableErrorMessage(job) {
        if (job.deferredFailure) {
            return job.deferredFailure;
        }
        if (this.opts.maxStartedAttempts &&
            this.opts.maxStartedAttempts < job.attemptsStarted) {
            return 'job started more than allowable limit';
        }
    }
    async handleCompleted(result, job, token, fetchNextCallback = () => true, span) {
        if (!this.connection.closing) {
            const completed = await job.moveToCompleted(result, token, fetchNextCallback() && !(this.closing || this.paused));
            this.emit('completed', job, result, 'active');
            span === null || span === void 0 ? void 0 : span.addEvent('job completed', {
                [enums_1.TelemetryAttributes.JobResult]: JSON.stringify(result),
            });
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobAttemptsMade]: job.attemptsMade,
            });
            if (Array.isArray(completed)) {
                const [jobData, jobId, rateLimitDelay, delayUntil] = completed;
                this.updateDelays(rateLimitDelay, delayUntil);
                return this.nextJobFromJobData(jobData, jobId, token);
            }
        }
    }
    async handleFailed(err, job, token, fetchNextCallback = () => true, span) {
        if (!this.connection.closing) {
            // Check if the job was manually rate-limited
            if (err.message === errors_1.RATE_LIMIT_ERROR) {
                const rateLimitTtl = await this.moveLimitedBackToWait(job, token);
                this.limitUntil = rateLimitTtl > 0 ? Date.now() + rateLimitTtl : 0;
                return;
            }
            const fetchNext = fetchNextCallback() && !(this.closing || this.paused);
            if (err instanceof errors_1.DelayedError ||
                err.name == 'DelayedError' ||
                err instanceof errors_1.WaitingError ||
                err.name == 'WaitingError' ||
                err instanceof errors_1.WaitingChildrenError ||
                err.name == 'WaitingChildrenError') {
                if (!fetchNext) {
                    return;
                }
                const client = await this.client;
                return this.moveToActive(client, token, this.opts.name);
            }
            const result = await job.moveToFailed(err, token, fetchNext);
            this.emit('failed', job, err, 'active');
            span === null || span === void 0 ? void 0 : span.addEvent('job failed', {
                [enums_1.TelemetryAttributes.JobFailedReason]: err.message,
            });
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobAttemptsMade]: job.attemptsMade,
            });
            // Note: result can be undefined if moveToFailed fails (e.g., lock was lost)
            if (Array.isArray(result)) {
                const [jobData, jobId, rateLimitDelay, delayUntil] = result;
                this.updateDelays(rateLimitDelay, delayUntil);
                return this.nextJobFromJobData(jobData, jobId, token);
            }
        }
    }
    /**
     *
     * Pauses the processing of this queue only for this worker.
     */
    async pause(doNotWaitActive) {
        await this.trace(enums_1.SpanKind.INTERNAL, 'pause', this.name, async (span) => {
            var _a;
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.WorkerId]: this.id,
                [enums_1.TelemetryAttributes.WorkerName]: this.opts.name,
                [enums_1.TelemetryAttributes.WorkerDoNotWaitActive]: doNotWaitActive,
            });
            if (!this.paused) {
                this.paused = true;
                if (!doNotWaitActive) {
                    await this.whenCurrentJobsFinished();
                }
                (_a = this.stalledCheckStopper) === null || _a === void 0 ? void 0 : _a.call(this);
                this.emit('paused');
            }
        });
    }
    /**
     *
     * Resumes processing of this worker (if paused).
     */
    resume() {
        if (!this.running || this.paused) {
            this.trace(enums_1.SpanKind.INTERNAL, 'resume', this.name, span => {
                span === null || span === void 0 ? void 0 : span.setAttributes({
                    [enums_1.TelemetryAttributes.WorkerId]: this.id,
                    [enums_1.TelemetryAttributes.WorkerName]: this.opts.name,
                });
                this.paused = false;
                if (!this.running) {
                    if (this.processFn) {
                        this.run();
                    }
                }
                else {
                    // TODO: await for startStalledCheckTimer in next breaking change, that will convert resume method to async
                    // Main loop is still running (pause was called with doNotWaitActive=true).
                    // Restart the stalled checker since pause() stopped it.
                    void this.startStalledCheckTimer().catch(err => {
                        this.emit('error', err);
                    });
                }
                this.emit('resumed');
            }).catch(err => {
                this.emit('error', err);
            });
        }
    }
    /**
     *
     * Checks if worker is paused.
     *
     * @returns true if worker is paused, false otherwise.
     */
    isPaused() {
        return !!this.paused;
    }
    /**
     *
     * Checks if worker is currently running.
     *
     * @returns true if worker is running, false otherwise.
     */
    isRunning() {
        return this.running;
    }
    /**
     *
     * Closes the worker and related redis connections.
     *
     * This method waits for current jobs to finalize before returning.
     *
     * @param force - Use force boolean parameter if you do not want to wait for
     * current jobs to be processed. When using telemetry, be mindful that it can
     * interfere with the proper closure of spans, potentially preventing them from being exported.
     *
     * @returns Promise that resolves when the worker has been closed.
     */
    async close(force = false) {
        if (this.closing) {
            return this.closing;
        }
        this.closing = (async () => {
            await this.trace(enums_1.SpanKind.INTERNAL, 'close', this.name, async (span) => {
                var _a, _b;
                span === null || span === void 0 ? void 0 : span.setAttributes({
                    [enums_1.TelemetryAttributes.WorkerId]: this.id,
                    [enums_1.TelemetryAttributes.WorkerName]: this.opts.name,
                    [enums_1.TelemetryAttributes.WorkerForceClose]: force,
                });
                this.emit('closing', 'closing queue');
                (_a = this.abortDelayController) === null || _a === void 0 ? void 0 : _a.abort();
                // Define the async cleanup functions
                const asyncCleanups = [
                    () => {
                        return force || this.whenCurrentJobsFinished(false);
                    },
                    () => this.lockManager.close(),
                    () => { var _a; return (_a = this.childPool) === null || _a === void 0 ? void 0 : _a.clean(); },
                    () => this.blockingConnection.close(force),
                    () => this.connection.close(force),
                ];
                // Run cleanup functions sequentially and make sure all are run despite any errors
                for (const cleanup of asyncCleanups) {
                    try {
                        await cleanup();
                    }
                    catch (err) {
                        this.emit('error', err);
                    }
                }
                (_b = this.stalledCheckStopper) === null || _b === void 0 ? void 0 : _b.call(this);
                this.closed = true;
                this.emit('closed');
            });
        })();
        return await this.closing;
    }
    /**
     *
     * Manually starts the stalled checker.
     * The check will run once as soon as this method is called, and
     * then every opts.stalledInterval milliseconds until the worker is closed.
     * Note: Normally you do not need to call this method, since the stalled checker
     * is automatically started when the worker starts processing jobs after
     * calling run. However if you want to process the jobs manually you need
     * to call this method to start the stalled checker.
     *
     * @see {@link https://docs.bullmq.io/patterns/manually-fetching-jobs}
     */
    async startStalledCheckTimer() {
        if (!this.opts.skipStalledCheck) {
            if (!this.closing && !this.stalledCheckerRunning) {
                await this.trace(enums_1.SpanKind.INTERNAL, 'startStalledCheckTimer', this.name, async (span) => {
                    span === null || span === void 0 ? void 0 : span.setAttributes({
                        [enums_1.TelemetryAttributes.WorkerId]: this.id,
                        [enums_1.TelemetryAttributes.WorkerName]: this.opts.name,
                    });
                    this.stalledCheckerRunning = true;
                    this.stalledChecker()
                        .catch(err => {
                        this.emit('error', err);
                    })
                        .finally(() => {
                        this.stalledCheckerRunning = false;
                    });
                });
            }
        }
    }
    async stalledChecker() {
        while (!(this.closing || this.paused)) {
            await this.checkConnectionError(() => this.moveStalledJobsToWait());
            await new Promise(resolve => {
                const timeout = setTimeout(resolve, this.opts.stalledInterval);
                this.stalledCheckStopper = () => {
                    clearTimeout(timeout);
                    resolve();
                };
            });
        }
    }
    /**
     * Returns a promise that resolves when active jobs are cleared
     *
     * @returns
     */
    async whenCurrentJobsFinished(reconnect = true) {
        // The blocking connection is dedicated to bzpopmin, so it is safe to
        // always disconnect it whenever the main loop is running. Waiting for the
        // actual disconnect ('end' event) is required to avoid a race where the
        // bzpopmin call is still in flight when the main loop awaits its result.
        if (this.mainLoopRunning) {
            await this.blockingConnection.disconnect(true);
            await this.mainLoopRunning;
        }
        else {
            reconnect = false;
        }
        reconnect && (await this.blockingConnection.reconnect());
    }
    async retryIfFailed(fn, opts) {
        var _a;
        let retry = 0;
        const maxRetries = opts.maxRetries || Infinity;
        do {
            try {
                return await fn();
            }
            catch (err) {
                (_a = opts.span) === null || _a === void 0 ? void 0 : _a.recordException(err.message);
                if ((0, utils_1.isNotConnectionError)(err)) {
                    // Emit error when not paused or closing; optionally swallow (no throw) when opts.onlyEmitError is set.
                    if (!this.paused && !this.closing) {
                        this.emit('error', err);
                    }
                    if (opts.onlyEmitError) {
                        return;
                    }
                    else {
                        throw err;
                    }
                }
                else {
                    if (opts.delayInMs && !this.closing && !this.closed) {
                        await this.delay(opts.delayInMs, this.abortDelayController);
                    }
                    if (retry + 1 >= maxRetries) {
                        // If we've reached max retries, throw the last error
                        throw err;
                    }
                }
            }
        } while (++retry < maxRetries);
    }
    async moveStalledJobsToWait() {
        await this.trace(enums_1.SpanKind.INTERNAL, 'moveStalledJobsToWait', this.name, async (span) => {
            const stalled = await this.scripts.moveStalledJobsToWait();
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.WorkerId]: this.id,
                [enums_1.TelemetryAttributes.WorkerName]: this.opts.name,
                [enums_1.TelemetryAttributes.WorkerStalledJobs]: stalled,
            });
            stalled.forEach((jobId) => {
                span === null || span === void 0 ? void 0 : span.addEvent('job stalled', {
                    [enums_1.TelemetryAttributes.JobId]: jobId,
                });
                this.emit('stalled', jobId, 'active');
            });
        });
    }
    moveLimitedBackToWait(job, token) {
        return job.moveToWait(token);
    }
}
exports.Worker = Worker;
