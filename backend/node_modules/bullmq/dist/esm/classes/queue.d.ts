import { BaseJobOptions, BulkJobOptions, IoredisListener, JobSchedulerJson, QueueOptions, RepeatableJob, RepeatOptions } from '../interfaces';
import { FinishedStatus, JobsOptions, JobSchedulerTemplateOptions, JobProgress } from '../types';
import { Job } from './job';
import { QueueGetters } from './queue-getters';
import { Repeat } from './repeat';
import { RedisConnection } from './redis-connection';
import { JobScheduler } from './job-scheduler';
export interface ObliterateOpts {
    /**
     * Use force = true to force obliteration even with active jobs in the queue
     * @defaultValue false
     */
    force?: boolean;
    /**
     * Use count with the maximum number of deleted keys per iteration
     * @defaultValue 1000
     */
    count?: number;
}
export interface QueueListener<JobBase extends Job = Job> extends IoredisListener {
    /**
     * Listen to 'cleaned' event.
     *
     * This event is triggered when the queue calls clean method.
     */
    cleaned: (jobs: string[], type: string) => void;
    /**
     * Listen to 'error' event.
     *
     * This event is triggered when an error is thrown.
     */
    error: (err: Error) => void;
    /**
     * Listen to 'paused' event.
     *
     * This event is triggered when the queue is paused.
     */
    paused: () => void;
    /**
     * Listen to 'progress' event.
     *
     * This event is triggered when the job updates its progress.
     */
    progress: (jobId: string, progress: JobProgress) => void;
    /**
     * Listen to 'removed' event.
     *
     * This event is triggered when a job is removed.
     */
    removed: (jobId: string) => void;
    /**
     * Listen to 'resumed' event.
     *
     * This event is triggered when the queue is resumed.
     */
    resumed: () => void;
    /**
     * Listen to 'waiting' event.
     *
     * This event is triggered when the queue creates a new job.
     */
    waiting: (job: JobBase) => void;
}
/**
 * IsAny<T> A type helper to determine if a given type `T` is `any`.
 * This works by using `any` type with the intersection
 * operator (`&`). If `T` is `any`, then `1 & T` resolves to `any`, and since `0`
 * is assignable to `any`, the conditional type returns `true`.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;
type JobBase<T, ResultType, NameType extends string> = IsAny<T> extends true ? Job<T, ResultType, NameType> : T extends Job<any, any, any> ? T : Job<T, ResultType, NameType>;
type ExtractDataType<DataTypeOrJob, Default> = DataTypeOrJob extends Job<infer D, any, any> ? D : Default;
type ExtractResultType<DataTypeOrJob, Default> = DataTypeOrJob extends Job<any, infer R, any> ? R : Default;
type ExtractNameType<DataTypeOrJob, Default extends string> = DataTypeOrJob extends Job<any, any, infer N> ? N : Default;
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
export declare class Queue<DataTypeOrJob = any, DefaultResultType = any, DefaultNameType extends string = string, DataType = ExtractDataType<DataTypeOrJob, DataTypeOrJob>, ResultType = ExtractResultType<DataTypeOrJob, DefaultResultType>, NameType extends string = ExtractNameType<DataTypeOrJob, DefaultNameType>> extends QueueGetters<JobBase<DataTypeOrJob, ResultType, NameType>> {
    token: string;
    jobsOpts: BaseJobOptions;
    opts: QueueOptions;
    protected libName: string;
    protected _repeat?: Repeat;
    protected _jobScheduler?: JobScheduler;
    constructor(name: string, opts?: QueueOptions, Connection?: typeof RedisConnection);
    emit<U extends keyof QueueListener<JobBase<DataType, ResultType, NameType>>>(event: U, ...args: Parameters<QueueListener<JobBase<DataType, ResultType, NameType>>[U]>): boolean;
    off<U extends keyof QueueListener<JobBase<DataType, ResultType, NameType>>>(eventName: U, listener: QueueListener<JobBase<DataType, ResultType, NameType>>[U]): this;
    on<U extends keyof QueueListener<JobBase<DataType, ResultType, NameType>>>(event: U, listener: QueueListener<JobBase<DataType, ResultType, NameType>>[U]): this;
    once<U extends keyof QueueListener<JobBase<DataType, ResultType, NameType>>>(event: U, listener: QueueListener<JobBase<DataType, ResultType, NameType>>[U]): this;
    /**
     * Returns this instance current default job options.
     */
    get defaultJobOptions(): JobsOptions;
    get metaValues(): Record<string, string | number>;
    /**
     * Get library version.
     *
     * @returns the content of the meta.library field.
     */
    getVersion(): Promise<string>;
    get repeat(): Promise<Repeat>;
    get jobScheduler(): Promise<JobScheduler>;
    /**
     * Enable and set global concurrency value.
     * @param concurrency - Maximum number of simultaneous jobs that the workers can handle.
     * For instance, setting this value to 1 ensures that no more than one job
     * is processed at any given time. If this limit is not defined, there will be no
     * restriction on the number of concurrent jobs.
     */
    setGlobalConcurrency(concurrency: number): Promise<number>;
    /**
     * Enable and set rate limit.
     * @param max - Max number of jobs to process in the time period specified in `duration`
     * @param duration - Time in milliseconds. During this time, a maximum of `max` jobs will be processed.
     */
    setGlobalRateLimit(max: number, duration: number): Promise<number>;
    /**
     * Remove global concurrency value.
     */
    removeGlobalConcurrency(): Promise<number>;
    /**
     * Remove global rate limit values.
     */
    removeGlobalRateLimit(): Promise<number>;
    /**
     * Adds a new job to the queue.
     *
     * @param name - Name of the job to be added to the queue.
     * @param data - Arbitrary data to append to the job.
     * @param opts - Job options that affects how the job is going to be processed.
     */
    add(name: NameType, data: DataType, opts?: JobsOptions): Promise<Job<DataType, ResultType, NameType>>;
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
    protected addJob(name: NameType, data: DataType, opts?: JobsOptions): Promise<Job<DataType, ResultType, NameType>>;
    /**
     * Adds an array of jobs to the queue. This method may be faster than adding
     * one job at a time in a sequence.
     *
     * @param jobs - The array of jobs to add to the queue. Each job is defined by 3
     * properties, 'name', 'data' and 'opts'. They follow the same signature as 'Queue.add'.
     */
    addBulk(jobs: {
        name: NameType;
        data: DataType;
        opts?: BulkJobOptions;
    }[]): Promise<Job<DataType, ResultType, NameType>[]>;
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
    upsertJobScheduler(jobSchedulerId: NameType, repeatOpts: Omit<RepeatOptions, 'key'>, jobTemplate?: {
        name?: NameType;
        data?: DataType;
        opts?: JobSchedulerTemplateOptions;
    }): Promise<Job<DataType, ResultType, NameType>>;
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
    pause(): Promise<void>;
    /**
     * Close the queue instance.
     *
     */
    close(): Promise<void>;
    /**
     * Overrides the rate limit to be active for the next jobs.
     *
     * @param expireTimeMs - expire time in ms of this rate limit.
     */
    rateLimit(expireTimeMs: number): Promise<void>;
    /**
     * Resumes the processing of this queue globally.
     *
     * The method reverses the pause operation by resuming the processing of the
     * queue.
     */
    resume(): Promise<void>;
    /**
     * Returns true if the queue is currently paused.
     */
    isPaused(): Promise<boolean>;
    /**
     * Returns true if the queue is currently maxed.
     */
    isMaxed(): Promise<boolean>;
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
    getRepeatableJobs(start?: number, end?: number, asc?: boolean): Promise<RepeatableJob[]>;
    /**
     * Get Job Scheduler by id
     *
     * @param id - identifier of scheduler.
     */
    getJobScheduler(id: string): Promise<JobSchedulerJson<DataType> | undefined>;
    /**
     * Get all Job Schedulers
     *
     * @param start - Offset of first scheduler to return.
     * @param end - Offset of last scheduler to return.
     * @param asc - Determine the order in which schedulers are returned based on their
     * next execution time.
     */
    getJobSchedulers(start?: number, end?: number, asc?: boolean): Promise<JobSchedulerJson<DataType>[]>;
    /**
     *
     * Get the number of job schedulers.
     *
     * @returns The number of job schedulers.
     */
    getJobSchedulersCount(): Promise<number>;
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
    removeRepeatable(name: NameType, repeatOpts: RepeatOptions, jobId?: string): Promise<boolean>;
    /**
     *
     * Removes a job scheduler.
     *
     * @param jobSchedulerId - identifier of the job scheduler.
     *
     * @returns
     */
    removeJobScheduler(jobSchedulerId: string): Promise<boolean>;
    /**
     * Removes a debounce key.
     * @deprecated use removeDeduplicationKey
     *
     * @param id - debounce identifier
     */
    removeDebounceKey(id: string): Promise<number>;
    /**
     * Removes a deduplication key.
     *
     * @param id - identifier
     */
    removeDeduplicationKey(id: string): Promise<number>;
    /**
     * Removes rate limit key.
     */
    removeRateLimitKey(): Promise<number>;
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
    removeRepeatableByKey(key: string): Promise<boolean>;
    /**
     * Removes the given job from the queue as well as all its
     * dependencies.
     *
     * @param jobId - The id of the job to remove
     * @param opts - Options to remove a job
     * @returns 1 if it managed to remove the job or 0 if the job or
     * any of its dependencies were locked.
     */
    remove(jobId: string, { removeChildren }?: {
        removeChildren?: boolean;
    }): Promise<number>;
    /**
     * Updates the given job's progress.
     *
     * @param jobId - The id of the job to update
     * @param progress - Number or object to be saved as progress.
     */
    updateJobProgress(jobId: string, progress: JobProgress): Promise<void>;
    /**
     * Logs one row of job's log data.
     *
     * @param jobId - The job id to log against.
     * @param logRow - String with log data to be logged.
     * @param keepLogs - Max number of log entries to keep (0 for unlimited).
     *
     * @returns The total number of log entries for this job so far.
     */
    addJobLog(jobId: string, logRow: string, keepLogs?: number): Promise<number>;
    /**
     * Drains the queue, i.e., removes all jobs that are waiting
     * or delayed, but not active, completed or failed.
     *
     * @param delayed - Pass true if it should also clean the
     * delayed jobs.
     */
    drain(delayed?: boolean): Promise<void>;
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
    clean(grace: number, limit: number, type?: 'completed' | 'wait' | 'waiting' | 'active' | 'paused' | 'prioritized' | 'delayed' | 'failed'): Promise<string[]>;
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
    obliterate(opts?: ObliterateOpts): Promise<void>;
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
    retryJobs(opts?: {
        count?: number;
        state?: FinishedStatus;
        timestamp?: number;
    }): Promise<void>;
    /**
     * Promote all the delayed jobs.
     *
     * @param opts - An object with the following properties:
     *   - count  number to limit how many jobs will be moved to wait status per iteration
     *
     * @returns
     */
    promoteJobs(opts?: {
        count?: number;
    }): Promise<void>;
    /**
     * Trim the event stream to an approximately maxLength.
     *
     * @param maxLength - The approximate maximum length, or target length, of the event stream.
     */
    trimEvents(maxLength: number): Promise<number>;
    /**
     * Delete old priority helper key.
     */
    removeDeprecatedPriorityKey(): Promise<number>;
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
    removeOrphanedJobs(count?: number, limit?: number): Promise<number>;
}
export {};
