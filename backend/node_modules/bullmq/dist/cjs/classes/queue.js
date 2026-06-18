"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queue = void 0;
const job_1 = require("./job");
const queue_getters_1 = require("./queue-getters");
const repeat_1 = require("./repeat");
const enums_1 = require("../enums");
const job_scheduler_1 = require("./job-scheduler");
const version_1 = require("../version");
const utils_1 = require("../utils");
/**
 * Queue
 *
 * This class provides methods to add jobs to a queue and some other high-level
 * administration such as pausing or deleting queues.
 *
 * @typeParam DataType - The type of the data that the job will process.
 * @typeParam ResultType - The type of the result of the job.
 * @typeParam NameType - The type of the name of the job.
 *
 * @example
 *
 * ```typescript
 * import { Queue } from 'bullmq';
 *
 * interface MyDataType {
 *  foo: string;
 * }
 *
 * interface MyResultType {
 *   bar: string;
 * }
 *
 * const queue = new Queue<MyDataType, MyResultType, "blue" | "brown">('myQueue');
 * ```
 */
class Queue extends queue_getters_1.QueueGetters {
    constructor(name, opts, Connection) {
        var _a;
        super(name, Object.assign({}, opts), Connection);
        this.token = (0, utils_1.randomUUID)();
        this.libName = 'bullmq';
        this.jobsOpts = (_a = opts === null || opts === void 0 ? void 0 : opts.defaultJobOptions) !== null && _a !== void 0 ? _a : {};
        this.waitUntilReady()
            .then(client => {
            if (!this.closing && !(opts === null || opts === void 0 ? void 0 : opts.skipMetasUpdate)) {
                return client.hset(this.keys.meta, this.metaValues);
            }
        })
            .catch(err => {
            // We ignore this error to avoid warnings. The error can still
            // be received by listening to event 'error'
        });
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
     * Returns this instance current default job options.
     */
    get defaultJobOptions() {
        return Object.assign({}, this.jobsOpts);
    }
    get metaValues() {
        var _a, _b, _c, _d;
        return {
            'opts.maxLenEvents': (_d = (_c = (_b = (_a = this.opts) === null || _a === void 0 ? void 0 : _a.streams) === null || _b === void 0 ? void 0 : _b.events) === null || _c === void 0 ? void 0 : _c.maxLen) !== null && _d !== void 0 ? _d : 10000,
            version: `${this.libName}:${version_1.version}`,
        };
    }
    /**
     * Get library version.
     *
     * @returns the content of the meta.library field.
     */
    async getVersion() {
        const client = await this.client;
        return await client.hget(this.keys.meta, 'version');
    }
    get repeat() {
        return new Promise(async (resolve) => {
            if (!this._repeat) {
                this._repeat = new repeat_1.Repeat(this.name, Object.assign(Object.assign({}, this.opts), { connection: await this.client }));
                this._repeat.on('error', this.emit.bind(this, 'error'));
            }
            resolve(this._repeat);
        });
    }
    get jobScheduler() {
        return new Promise(async (resolve) => {
            if (!this._jobScheduler) {
                this._jobScheduler = new job_scheduler_1.JobScheduler(this.name, Object.assign(Object.assign({}, this.opts), { connection: await this.client }));
                this._jobScheduler.on('error', this.emit.bind(this, 'error'));
            }
            resolve(this._jobScheduler);
        });
    }
    /**
     * Enable and set global concurrency value.
     * @param concurrency - Maximum number of simultaneous jobs that the workers can handle.
     * For instance, setting this value to 1 ensures that no more than one job
     * is processed at any given time. If this limit is not defined, there will be no
     * restriction on the number of concurrent jobs.
     */
    async setGlobalConcurrency(concurrency) {
        const client = await this.client;
        return client.hset(this.keys.meta, { concurrency });
    }
    /**
     * Enable and set rate limit.
     * @param max - Max number of jobs to process in the time period specified in `duration`
     * @param duration - Time in milliseconds. During this time, a maximum of `max` jobs will be processed.
     */
    async setGlobalRateLimit(max, duration) {
        const client = await this.client;
        return client.hset(this.keys.meta, { max, duration });
    }
    /**
     * Remove global concurrency value.
     */
    async removeGlobalConcurrency() {
        const client = await this.client;
        return client.hdel(this.keys.meta, 'concurrency');
    }
    /**
     * Remove global rate limit values.
     */
    async removeGlobalRateLimit() {
        const client = await this.client;
        return client.hdel(this.keys.meta, 'max', 'duration');
    }
    /**
     * Adds a new job to the queue.
     *
     * @param name - Name of the job to be added to the queue.
     * @param data - Arbitrary data to append to the job.
     * @param opts - Job options that affects how the job is going to be processed.
     */
    async add(name, data, opts) {
        return this.trace(enums_1.SpanKind.PRODUCER, 'add', `${this.name}.${name}`, async (span, srcPropagationMetadata) => {
            var _a;
            if (srcPropagationMetadata && !((_a = opts === null || opts === void 0 ? void 0 : opts.telemetry) === null || _a === void 0 ? void 0 : _a.omitContext)) {
                const telemetry = {
                    metadata: srcPropagationMetadata,
                };
                opts = Object.assign(Object.assign({}, opts), { telemetry });
            }
            const job = await this.addJob(name, data, opts);
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobName]: name,
                [enums_1.TelemetryAttributes.JobId]: job.id,
            });
            return job;
        });
    }
    /**
     * addJob is a telemetry free version of the add method, useful in order to wrap it
     * with custom telemetry on subclasses.
     *
     * @param name - Name of the job to be added to the queue.
     * @param data - Arbitrary data to append to the job.
     * @param opts - Job options that affects how the job is going to be processed.
     *
     * @returns Job
     */
    async addJob(name, data, opts) {
        if (opts && opts.repeat) {
            if (opts.repeat.endDate) {
                if (+new Date(opts.repeat.endDate) < Date.now()) {
                    throw new Error('End date must be greater than current timestamp');
                }
            }
            return (await this.repeat).updateRepeatableJob(name, data, Object.assign(Object.assign({}, this.jobsOpts), opts), { override: true });
        }
        else {
            const jobId = opts === null || opts === void 0 ? void 0 : opts.jobId;
            if (jobId == '0' || (jobId === null || jobId === void 0 ? void 0 : jobId.startsWith('0:'))) {
                throw new Error("JobId cannot be '0' or start with 0:");
            }
            const mergedOpts = Object.assign(Object.assign(Object.assign({}, this.jobsOpts), opts), { jobId });
            const job = await this.Job.create(this, name, data, mergedOpts);
            this.emit('waiting', job);
            return job;
        }
    }
    /**
     * Adds an array of jobs to the queue. This method may be faster than adding
     * one job at a time in a sequence.
     *
     * @param jobs - The array of jobs to add to the queue. Each job is defined by 3
     * properties, 'name', 'data' and 'opts'. They follow the same signature as 'Queue.add'.
     */
    async addBulk(jobs) {
        return this.trace(enums_1.SpanKind.PRODUCER, 'addBulk', this.name, async (span, srcPropagationMetadata) => {
            if (span) {
                span.setAttributes({
                    [enums_1.TelemetryAttributes.BulkNames]: jobs.map(job => job.name),
                    [enums_1.TelemetryAttributes.BulkCount]: jobs.length,
                });
            }
            return await this.Job.createBulk(this, jobs.map(job => {
                var _a, _b, _c, _d, _e, _f;
                let telemetry = (_a = job.opts) === null || _a === void 0 ? void 0 : _a.telemetry;
                if (srcPropagationMetadata) {
                    const omitContext = (_c = (_b = job.opts) === null || _b === void 0 ? void 0 : _b.telemetry) === null || _c === void 0 ? void 0 : _c.omitContext;
                    const telemetryMetadata = ((_e = (_d = job.opts) === null || _d === void 0 ? void 0 : _d.telemetry) === null || _e === void 0 ? void 0 : _e.metadata) ||
                        (!omitContext && srcPropagationMetadata);
                    if (telemetryMetadata || omitContext) {
                        telemetry = {
                            metadata: telemetryMetadata,
                            omitContext,
                        };
                    }
                }
                const mergedOpts = Object.assign(Object.assign(Object.assign({}, this.jobsOpts), job.opts), { jobId: (_f = job.opts) === null || _f === void 0 ? void 0 : _f.jobId, telemetry });
                return {
                    name: job.name,
                    data: job.data,
                    opts: mergedOpts,
                };
            }));
        });
    }
    /**
     * Upserts a scheduler.
     *
     * A scheduler is a job factory that creates jobs at a given interval.
     * Upserting a scheduler will create a new job scheduler or update an existing one.
     * It will also create the first job based on the repeat options and delayed accordingly.
     *
     * @param key - Unique key for the repeatable job meta.
     * @param repeatOpts - Repeat options
     * @param jobTemplate - Job template. If provided it will be used for all the jobs
     * created by the scheduler.
     *
     * @returns The next job to be scheduled (would normally be in delayed state).
     */
    async upsertJobScheduler(jobSchedulerId, repeatOpts, jobTemplate) {
        var _a, _b;
        if (repeatOpts.endDate) {
            if (+new Date(repeatOpts.endDate) < Date.now()) {
                throw new Error('End date must be greater than current timestamp');
            }
        }
        return (await this.jobScheduler).upsertJobScheduler(jobSchedulerId, repeatOpts, (_a = jobTemplate === null || jobTemplate === void 0 ? void 0 : jobTemplate.name) !== null && _a !== void 0 ? _a : jobSchedulerId, (_b = jobTemplate === null || jobTemplate === void 0 ? void 0 : jobTemplate.data) !== null && _b !== void 0 ? _b : {}, Object.assign(Object.assign({}, this.jobsOpts), jobTemplate === null || jobTemplate === void 0 ? void 0 : jobTemplate.opts), { override: true });
    }
    /**
     * Pauses the processing of this queue globally.
     *
     * We use an atomic RENAME operation on the wait queue. Since
     * we have blocking calls with BRPOPLPUSH on the wait queue, as long as the queue
     * is renamed to 'paused', no new jobs will be processed (the current ones
     * will run until finalized).
     *
     * Adding jobs requires a LUA script to check first if the paused list exist
     * and in that case it will add it there instead of the wait list.
     */
    async pause() {
        await this.trace(enums_1.SpanKind.INTERNAL, 'pause', this.name, async () => {
            await this.scripts.pause(true);
            this.emit('paused');
        });
    }
    /**
     * Close the queue instance.
     *
     */
    async close() {
        await this.trace(enums_1.SpanKind.INTERNAL, 'close', this.name, async () => {
            if (!this.closing) {
                if (this._repeat) {
                    await this._repeat.close();
                }
            }
            await super.close();
        });
    }
    /**
     * Overrides the rate limit to be active for the next jobs.
     *
     * @param expireTimeMs - expire time in ms of this rate limit.
     */
    async rateLimit(expireTimeMs) {
        await this.trace(enums_1.SpanKind.INTERNAL, 'rateLimit', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.QueueRateLimit]: expireTimeMs,
            });
            await this.client.then(client => client.set(this.keys.limiter, Number.MAX_SAFE_INTEGER, {
                PX: expireTimeMs,
            }));
        });
    }
    /**
     * Resumes the processing of this queue globally.
     *
     * The method reverses the pause operation by resuming the processing of the
     * queue.
     */
    async resume() {
        await this.trace(enums_1.SpanKind.INTERNAL, 'resume', this.name, async () => {
            await this.scripts.pause(false);
            this.emit('resumed');
        });
    }
    /**
     * Returns true if the queue is currently paused.
     */
    async isPaused() {
        const client = await this.client;
        const pausedKeyExists = await client.hexists(this.keys.meta, 'paused');
        return pausedKeyExists === 1;
    }
    /**
     * Returns true if the queue is currently maxed.
     */
    isMaxed() {
        return this.scripts.isMaxed();
    }
    /**
     * Get all repeatable meta jobs.
     *
     * @deprecated This method is deprecated and will be removed in v6. Use getJobSchedulers instead.
     *
     * @param start - Offset of first job to return.
     * @param end - Offset of last job to return.
     * @param asc - Determine the order in which jobs are returned based on their
     * next execution time.
     */
    async getRepeatableJobs(start, end, asc) {
        return (await this.repeat).getRepeatableJobs(start, end, asc);
    }
    /**
     * Get Job Scheduler by id
     *
     * @param id - identifier of scheduler.
     */
    async getJobScheduler(id) {
        return (await this.jobScheduler).getScheduler(id);
    }
    /**
     * Get all Job Schedulers
     *
     * @param start - Offset of first scheduler to return.
     * @param end - Offset of last scheduler to return.
     * @param asc - Determine the order in which schedulers are returned based on their
     * next execution time.
     */
    async getJobSchedulers(start, end, asc) {
        return (await this.jobScheduler).getJobSchedulers(start, end, asc);
    }
    /**
     *
     * Get the number of job schedulers.
     *
     * @returns The number of job schedulers.
     */
    async getJobSchedulersCount() {
        return (await this.jobScheduler).getSchedulersCount();
    }
    /**
     * Removes a repeatable job.
     *
     * Note: you need to use the exact same repeatOpts when deleting a repeatable job
     * than when adding it.
     *
     * @deprecated This method is deprecated and will be removed in v6. Use removeJobScheduler instead.
     *
     * @see removeRepeatableByKey
     *
     * @param name - Job name
     * @param repeatOpts - Repeat options
     * @param jobId - Job id to remove. If not provided, all jobs with the same repeatOpts
     * @returns
     */
    async removeRepeatable(name, repeatOpts, jobId) {
        return this.trace(enums_1.SpanKind.INTERNAL, 'removeRepeatable', `${this.name}.${name}`, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobName]: name,
                [enums_1.TelemetryAttributes.JobId]: jobId,
            });
            const repeat = await this.repeat;
            const removed = await repeat.removeRepeatable(name, repeatOpts, jobId);
            return !removed;
        });
    }
    /**
     *
     * Removes a job scheduler.
     *
     * @param jobSchedulerId - identifier of the job scheduler.
     *
     * @returns
     */
    async removeJobScheduler(jobSchedulerId) {
        const jobScheduler = await this.jobScheduler;
        const removed = await jobScheduler.removeJobScheduler(jobSchedulerId);
        return !removed;
    }
    /**
     * Removes a debounce key.
     * @deprecated use removeDeduplicationKey
     *
     * @param id - debounce identifier
     */
    async removeDebounceKey(id) {
        return this.trace(enums_1.SpanKind.INTERNAL, 'removeDebounceKey', `${this.name}`, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobKey]: id,
            });
            const client = await this.client;
            return await client.del(`${this.keys.de}:${id}`);
        });
    }
    /**
     * Removes a deduplication key.
     *
     * @param id - identifier
     */
    async removeDeduplicationKey(id) {
        return this.trace(enums_1.SpanKind.INTERNAL, 'removeDeduplicationKey', `${this.name}`, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.DeduplicationKey]: id,
            });
            const client = await this.client;
            return client.del(`${this.keys.de}:${id}`);
        });
    }
    /**
     * Removes rate limit key.
     */
    async removeRateLimitKey() {
        const client = await this.client;
        return client.del(this.keys.limiter);
    }
    /**
     * Removes a repeatable job by its key. Note that the key is the one used
     * to store the repeatable job metadata and not one of the job iterations
     * themselves. You can use "getRepeatableJobs" in order to get the keys.
     *
     * @see getRepeatableJobs
     *
     * @deprecated This method is deprecated and will be removed in v6. Use removeJobScheduler instead.
     *
     * @param repeatJobKey - To the repeatable job.
     * @returns
     */
    async removeRepeatableByKey(key) {
        return this.trace(enums_1.SpanKind.INTERNAL, 'removeRepeatableByKey', `${this.name}`, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobKey]: key,
            });
            const repeat = await this.repeat;
            const removed = await repeat.removeRepeatableByKey(key);
            return !removed;
        });
    }
    /**
     * Removes the given job from the queue as well as all its
     * dependencies.
     *
     * @param jobId - The id of the job to remove
     * @param opts - Options to remove a job
     * @returns 1 if it managed to remove the job or 0 if the job or
     * any of its dependencies were locked.
     */
    async remove(jobId, { removeChildren = true } = {}) {
        return this.trace(enums_1.SpanKind.INTERNAL, 'remove', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobId]: jobId,
                [enums_1.TelemetryAttributes.JobOptions]: JSON.stringify({
                    removeChildren,
                }),
            });
            const code = await this.scripts.remove(jobId, removeChildren);
            if (code === 1) {
                this.emit('removed', jobId);
            }
            return code;
        });
    }
    /**
     * Updates the given job's progress.
     *
     * @param jobId - The id of the job to update
     * @param progress - Number or object to be saved as progress.
     */
    async updateJobProgress(jobId, progress) {
        await this.trace(enums_1.SpanKind.INTERNAL, 'updateJobProgress', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.JobId]: jobId,
                [enums_1.TelemetryAttributes.JobProgress]: JSON.stringify(progress),
            });
            await this.scripts.updateProgress(jobId, progress);
            this.emit('progress', jobId, progress);
        });
    }
    /**
     * Logs one row of job's log data.
     *
     * @param jobId - The job id to log against.
     * @param logRow - String with log data to be logged.
     * @param keepLogs - Max number of log entries to keep (0 for unlimited).
     *
     * @returns The total number of log entries for this job so far.
     */
    async addJobLog(jobId, logRow, keepLogs) {
        return job_1.Job.addJobLog(this, jobId, logRow, keepLogs);
    }
    /**
     * Drains the queue, i.e., removes all jobs that are waiting
     * or delayed, but not active, completed or failed.
     *
     * @param delayed - Pass true if it should also clean the
     * delayed jobs.
     */
    async drain(delayed = false) {
        await this.trace(enums_1.SpanKind.INTERNAL, 'drain', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.QueueDrainDelay]: delayed,
            });
            await this.scripts.drain(delayed);
        });
    }
    /**
     * Cleans jobs from a queue. Similar to drain but keeps jobs within a certain
     * grace period.
     *
     * @param grace - The grace period in milliseconds
     * @param limit - Max number of jobs to clean
     * @param type - The type of job to clean
     * Possible values are completed, wait, active, paused, delayed, failed. Defaults to completed.
     * @returns Id jobs from the deleted records
     */
    async clean(grace, limit, type = 'completed') {
        return this.trace(enums_1.SpanKind.INTERNAL, 'clean', this.name, async (span) => {
            const maxCount = limit || Infinity;
            const maxCountPerCall = Math.min(10000, maxCount);
            const timestamp = Date.now() - grace;
            let deletedCount = 0;
            const deletedJobsIds = [];
            // Normalize 'waiting' to 'wait' for consistency with internal Redis keys
            const normalizedType = type === 'waiting' ? 'wait' : type;
            while (deletedCount < maxCount) {
                const jobsIds = await this.scripts.cleanJobsInSet(normalizedType, timestamp, maxCountPerCall);
                this.emit('cleaned', jobsIds, normalizedType);
                deletedCount += jobsIds.length;
                deletedJobsIds.push(...jobsIds);
                if (jobsIds.length < maxCountPerCall) {
                    break;
                }
            }
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.QueueGrace]: grace,
                [enums_1.TelemetryAttributes.JobType]: type,
                [enums_1.TelemetryAttributes.QueueCleanLimit]: maxCount,
                [enums_1.TelemetryAttributes.JobIds]: deletedJobsIds,
            });
            return deletedJobsIds;
        });
    }
    /**
     * Completely destroys the queue and all of its contents irreversibly.
     * This method will *pause* the queue and requires that there are no
     * active jobs. It is possible to bypass this requirement, i.e. not
     * having active jobs using the "force" option.
     *
     * Note: This operation requires to iterate on all the jobs stored in the queue
     * and can be slow for very large queues.
     *
     * @param opts - Obliterate options.
     */
    async obliterate(opts) {
        await this.trace(enums_1.SpanKind.INTERNAL, 'obliterate', this.name, async () => {
            await this.pause();
            let cursor = 0;
            do {
                cursor = await this.scripts.obliterate(Object.assign({ force: false, count: 1000 }, opts));
            } while (cursor);
        });
    }
    /**
     * Retry all the failed or completed jobs.
     *
     * @param opts - An object with the following properties:
     *   - count  number to limit how many jobs will be moved to wait status per iteration,
     *   - state  failed by default or completed.
     *   - timestamp from which timestamp to start moving jobs to wait status, default Date.now().
     *
     * @returns
     */
    async retryJobs(opts = {}) {
        await this.trace(enums_1.SpanKind.PRODUCER, 'retryJobs', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.QueueOptions]: JSON.stringify(opts),
            });
            let cursor = 0;
            do {
                cursor = await this.scripts.retryJobs(opts.state, opts.count, opts.timestamp);
            } while (cursor);
        });
    }
    /**
     * Promote all the delayed jobs.
     *
     * @param opts - An object with the following properties:
     *   - count  number to limit how many jobs will be moved to wait status per iteration
     *
     * @returns
     */
    async promoteJobs(opts = {}) {
        await this.trace(enums_1.SpanKind.INTERNAL, 'promoteJobs', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.QueueOptions]: JSON.stringify(opts),
            });
            let cursor = 0;
            do {
                cursor = await this.scripts.promoteJobs(opts.count);
            } while (cursor);
        });
    }
    /**
     * Trim the event stream to an approximately maxLength.
     *
     * @param maxLength - The approximate maximum length, or target length, of the event stream.
     */
    async trimEvents(maxLength) {
        return this.trace(enums_1.SpanKind.INTERNAL, 'trimEvents', this.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [enums_1.TelemetryAttributes.QueueEventMaxLength]: maxLength,
            });
            const client = await this.client;
            return await client.xtrim(this.keys.events, 'MAXLEN', maxLength, {
                approximate: true,
            });
        });
    }
    /**
     * Delete old priority helper key.
     */
    async removeDeprecatedPriorityKey() {
        const client = await this.client;
        return client.del(this.toKey('priority'));
    }
    /**
     * Removes orphaned job keys that exist in Redis but are not referenced
     * in any queue state set.
     *
     * Orphaned keys can occur in rare cases when the removal-by-max-age logic
     * removes sorted-set entries without fully cleaning up the corresponding
     * job hash data (a regression introduced in v5.66.6 via #3694).
     * Under normal operation this method is
     * **not needed** — it is provided only as a one-time migration helper for
     * users who were affected by that specific bug and want to reclaim the
     * leaked memory.
     *
     * The method uses a Lua script so that every check-and-delete cycle is
     * atomic (per SCAN iteration). State keys are derived dynamically from
     * the queue's key map and their Redis TYPE is checked at runtime, so newly
     * introduced states are picked up automatically.
     *
     * @param count - Approximate number of keys to SCAN per iteration (default 1000).
     * @param limit - Maximum number of orphaned jobs to remove (0 = unlimited).
     *   When set, the method returns as soon as the limit is reached.
     *   Users with a very large number of orphans can call this method
     *   in a loop: `while (await queue.removeOrphanedJobs(1000, 10000)) {}`
     * @returns The total number of orphaned jobs that were removed.
     */
    async removeOrphanedJobs(count = 1000, limit = 0) {
        const client = await this.client;
        // Derive infrastructure suffixes dynamically from the queue key map
        // so any future keys are automatically excluded without code changes.
        const knownSuffixes = new Set(Object.keys(this.keys));
        // State key suffixes (excluding '') — passed to the Lua script which
        // uses TYPE to decide whether a key is a list / zset / set and picks
        // the right membership command automatically.
        const stateKeySuffixes = Object.keys(this.keys).filter(s => s !== '');
        // Known job sub-key suffixes (cleaned up during deletion).
        const jobSubKeySuffixes = [
            'logs',
            'dependencies',
            'processed',
            'failed',
            'unsuccessful',
            'lock',
        ];
        const basePrefix = this.qualifiedName + ':';
        const scanPattern = basePrefix + '*';
        let totalRemoved = 0;
        let cursor = '0';
        do {
            const [nextCursor, keys] = await client.scan(cursor, {
                MATCH: scanPattern,
                COUNT: count,
            });
            cursor = nextCursor;
            // Extract unique potential job IDs from this batch.
            const candidateJobIds = new Set();
            for (const key of keys) {
                const suffix = key.slice(basePrefix.length);
                // Skip infrastructure keys (derived from this.keys).
                if (knownSuffixes.has(suffix)) {
                    continue;
                }
                // Skip sub-keys of infrastructure prefixes (e.g. repeat:xxx, de:xxx).
                const colonIdx = suffix.indexOf(':');
                if (colonIdx !== -1) {
                    const prefixPart = suffix.slice(0, colonIdx);
                    if (knownSuffixes.has(prefixPart)) {
                        continue;
                    }
                }
                // Extract the job ID portion (before first colon, or the whole suffix).
                const jobId = colonIdx === -1 ? suffix : suffix.slice(0, colonIdx);
                // For sub-keys, only consider known job sub-key suffixes.
                if (colonIdx !== -1) {
                    const subKey = suffix.slice(colonIdx + 1);
                    if (!jobSubKeySuffixes.includes(subKey)) {
                        continue;
                    }
                }
                candidateJobIds.add(jobId);
            }
            if (candidateJobIds.size === 0) {
                continue;
            }
            // Run the Lua script atomically for this batch of candidates.
            const result = await this.scripts.removeOrphanedJobs([...candidateJobIds], stateKeySuffixes, jobSubKeySuffixes);
            totalRemoved += result || 0;
            if (limit > 0 && totalRemoved >= limit) {
                break;
            }
        } while (cursor !== '0');
        return totalRemoved;
    }
}
exports.Queue = Queue;
