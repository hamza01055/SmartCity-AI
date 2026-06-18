import { BulkJobOptions, DependenciesOpts, IRedisTransaction, JobJson, JobJsonRaw, MinimalJob, MinimalQueue, MoveToWaitingChildrenOpts, ParentKeys, ParentKeyOpts, RedisClient, RetryOptions } from '../interfaces';
import { FinishedStatus, JobsOptions, JobState, JobJsonSandbox, RedisJobOptions, JobProgress } from '../types';
import { Scripts } from './scripts';
import type { QueueEvents } from './queue-events';
export declare const PRIORITY_LIMIT: number;
/**
 * Job
 *
 * This class represents a Job in the queue. Normally job are implicitly created when
 * you add a job to the queue with methods such as Queue.addJob( ... )
 *
 * A Job instance is also passed to the Worker's process function.
 *
 */
export declare class Job<DataType = any, ReturnType = any, NameType extends string = string> implements MinimalJob<DataType, ReturnType, NameType> {
    protected queue: MinimalQueue;
    /**
     * The name of the Job
     */
    name: NameType;
    /**
     * The payload for this job.
     */
    data: DataType;
    /**
     * The options object for this job.
     */
    opts: JobsOptions;
    id?: string;
    /**
     * It includes the prefix, the namespace separator :, and queue name.
     * @see {@link https://www.gnu.org/software/gawk/manual/html_node/Qualified-Names.html}
     */
    readonly queueQualifiedName: string;
    /**
     * The progress a job has performed so far.
     * @defaultValue 0
     */
    progress: JobProgress;
    /**
     * The value returned by the processor when processing this job.
     * @defaultValue null
     */
    returnvalue: ReturnType;
    /**
     * Stacktrace for the error (for failed jobs).
     * @defaultValue null
     */
    stacktrace: string[] | null;
    /**
     * An amount of milliseconds to wait until this job can be processed.
     * @defaultValue 0
     */
    delay: number;
    /**
     * Ranges from 0 (highest priority) to 2 097 152 (lowest priority). Note that
     * using priorities has a slight impact on performance,
     * so do not use it if not required.
     * @defaultValue 0
     */
    priority: number;
    /**
     * Timestamp when the job was created (unless overridden with job options).
     */
    timestamp: number;
    /**
     * Number of attempts when job is moved to active.
     * @defaultValue 0
     */
    attemptsStarted: number;
    /**
     * Number of attempts after the job has failed.
     * @defaultValue 0
     */
    attemptsMade: number;
    /**
     * Number of times where job has stalled.
     * @defaultValue 0
     */
    stalledCounter: number;
    /**
     * Reason for failing.
     */
    failedReason: string;
    /**
     * Deferred failure. Stores a failed message and marks this job to be failed directly
     * as soon as the job is picked up by a worker, and using this string as the failed reason.
     */
    deferredFailure: string;
    /**
     * Timestamp for when the job finished (completed or failed).
     */
    finishedOn?: number;
    /**
     * Timestamp for when the job was processed.
     */
    processedOn?: number;
    /**
     * Fully qualified key (including the queue prefix) pointing to the parent of this job.
     */
    parentKey?: string;
    /**
     * Object that contains parentId (id) and parent queueKey.
     */
    parent?: ParentKeys;
    /**
     * Debounce identifier.
     * @deprecated use deduplicationId
     */
    debounceId?: string;
    /**
     * Deduplication identifier.
     */
    deduplicationId?: string;
    /**
     * Base repeat job key.
     */
    repeatJobKey?: string;
    /**
     * Produced next repetable job Id.
     *
     */
    nextRepeatableJobId?: string;
    /**
     * The token used for locking this job.
     */
    token?: string;
    /**
     * The worker name that is processing or processed this job.
     */
    processedBy?: string;
    protected toKey: (type: string) => string;
    /**
     * @deprecated use UnrecoverableError
     */
    protected discarded: boolean;
    protected scripts: Scripts;
    constructor(queue: MinimalQueue, 
    /**
     * The name of the Job
     */
    name: NameType, 
    /**
     * The payload for this job.
     */
    data: DataType, 
    /**
     * The options object for this job.
     */
    opts?: JobsOptions, id?: string);
    /**
     * Creates a new job and adds it to the queue.
     *
     * @param queue - the queue where to add the job.
     * @param name - the name of the job.
     * @param data - the payload of the job.
     * @param opts - the options bag for this job.
     * @returns The created Job instance
     */
    static create<T = any, R = any, N extends string = string>(queue: MinimalQueue, name: N, data: T, opts?: JobsOptions): Promise<Job<T, R, N>>;
    /**
     * Creates a bulk of jobs and adds them atomically to the given queue.
     *
     * @param queue - the queue where to add the jobs.
     * @param jobs - an array of jobs to be added to the queue.
     * @returns The created Job instances
     */
    static createBulk<T = any, R = any, N extends string = string>(queue: MinimalQueue, jobs: {
        name: N;
        data: T;
        opts?: BulkJobOptions;
    }[]): Promise<Job<T, R, N>[]>;
    /**
     * Instantiates a Job from a JobJsonRaw object (coming from a deserialized JSON object)
     *
     * @param queue - the queue where the job belongs to.
     * @param json - the plain object containing the job.
     * @param jobId - an optional job id (overrides the id coming from the JSON object)
     * @returns A Job instance reconstructed from the JSON data
     */
    static fromJSON<T = any, R = any, N extends string = string>(queue: MinimalQueue, json: JobJsonRaw, jobId?: string): Job<T, R, N>;
    protected createScripts(): void;
    static optsFromJSON(rawOpts?: string, optsDecode?: Record<string, string>): JobsOptions;
    /**
     * Fetches a Job from the queue given the passed job id.
     *
     * @param queue - the queue where the job belongs to.
     * @param jobId - the job id.
     * @returns
     */
    static fromId<T = any, R = any, N extends string = string>(queue: MinimalQueue, jobId: string): Promise<Job<T, R, N> | undefined>;
    /**
     * addJobLog
     *
     * @param queue - A minimal queue instance
     * @param jobId - Job id
     * @param logRow - String with a row of log data to be logged
     * @param keepLogs - The optional amount of log entries to preserve
     *
     * @returns The total number of log entries for this job so far.
     */
    static addJobLog(queue: MinimalQueue, jobId: string, logRow: string, keepLogs?: number): Promise<number>;
    toJSON(): Omit<this, "toJSON" | "scripts" | "prefix" | "queueName" | "moveToWaitingChildren" | "getChildrenValues" | "getIgnoredChildrenFailures" | "getDependenciesCount" | "getDependencies" | "addJob" | "removeDeduplicationKey" | "removeUnprocessedChildren" | "extendLock" | "updateData" | "updateProgress" | "removeChildDependency" | "getState" | "changeDelay" | "changePriority" | "moveToDelayed" | "promote" | "discard" | "queue" | "asJSON" | "asJSONSandbox" | "log" | "clearLogs" | "remove" | "moveToCompleted" | "moveToWait" | "moveToFailed" | "isCompleted" | "isFailed" | "isDelayed" | "isWaitingChildren" | "isActive" | "isWaiting" | "getFailedChildrenValues" | "waitUntilFinished" | "retry">;
    /**
     * Prepares a job to be serialized for storage in Redis.
     * @returns
     */
    asJSON(): JobJson;
    static optsAsJSON(opts?: JobsOptions, optsEncode?: Record<string, string>): RedisJobOptions;
    /**
     * Prepares a job to be passed to Sandbox.
     * @returns
     */
    asJSONSandbox(): JobJsonSandbox;
    /**
     * Updates a job's data
     *
     * @param data - the data that will replace the current jobs data.
     */
    updateData(data: DataType): Promise<void>;
    /**
     * Updates a job's progress
     *
     * @param progress - number or object to be saved as progress.
     */
    updateProgress(progress: JobProgress): Promise<void>;
    /**
     * Logs one row of log data.
     *
     * @param logRow - string with log data to be logged.
     * @returns The total number of log entries for this job so far.
     */
    log(logRow: string): Promise<number>;
    /**
     * Removes child dependency from parent when child is not yet finished
     *
     * @returns True if the relationship existed and if it was removed.
     */
    removeChildDependency(): Promise<boolean>;
    /**
     * Clears job's logs
     *
     * @param keepLogs - the amount of log entries to preserve
     */
    clearLogs(keepLogs?: number): Promise<void>;
    /**
     * Completely remove the job from the queue.
     * Note, this call will throw an exception if the job
     * is being processed when the call is performed.
     *
     * @param opts - Options to remove a job
     */
    remove({ removeChildren }?: {
        removeChildren?: boolean;
    }): Promise<void>;
    /**
     * Remove all children from this job that are not yet processed,
     * in other words that are in any other state than completed, failed or active.
     *
     * @remarks
     *  - Jobs with locks (most likely active) are ignored.
     *  - This method can be slow if the number of children is large (\> 1000).
     */
    removeUnprocessedChildren(): Promise<void>;
    /**
     * Extend the lock for this job.
     *
     * @param token - unique token for the lock
     * @param duration - lock duration in milliseconds
     */
    extendLock(token: string, duration: number): Promise<number>;
    /**
     * Moves a job to the completed queue.
     * Returned job to be used with Queue.prototype.nextJobFromJobData.
     *
     * @param returnValue - The jobs success message.
     * @param token - Worker token used to acquire completed job.
     * @param fetchNext - True when wanting to fetch the next job.
     * @returns Returns the jobData of the next job in the waiting queue or void.
     */
    moveToCompleted(returnValue: ReturnType, token: string, fetchNext?: boolean): Promise<void | any[]>;
    /**
     * Moves a job to the wait or prioritized state.
     *
     * @param token - Worker token used to acquire completed job.
     * @returns Returns pttl.
     */
    moveToWait(token?: string): Promise<number>;
    private shouldRetryJob;
    /**
     * Moves a job to the failed queue.
     *
     * @param err - the jobs error message.
     * @param token - token to check job is locked by current worker
     * @param fetchNext - true when wanting to fetch the next job
     * @returns Returns the jobData of the next job in the waiting queue or void.
     */
    moveToFailed<E extends Error>(err: E, token: string, fetchNext?: boolean): Promise<void | any[]>;
    private getSpanOperation;
    /**
     * Records job metrics if a meter is configured in telemetry options.
     *
     * @param status - The job status
     */
    private recordJobMetrics;
    /**
     * @returns true if the job has completed.
     */
    isCompleted(): Promise<boolean>;
    /**
     * @returns true if the job has failed.
     */
    isFailed(): Promise<boolean>;
    /**
     * @returns true if the job is delayed.
     */
    isDelayed(): Promise<boolean>;
    /**
     * @returns true if the job is waiting for children.
     */
    isWaitingChildren(): Promise<boolean>;
    /**
     * @returns true of the job is active.
     */
    isActive(): Promise<boolean>;
    /**
     * @returns true if the job is waiting.
     */
    isWaiting(): Promise<boolean>;
    /**
     * @returns the queue name this job belongs to.
     */
    get queueName(): string;
    /**
     * @returns the prefix that is used.
     */
    get prefix(): string;
    /**
     * Get current state.
     *
     * @returns Returns one of these values:
     * 'completed', 'failed', 'delayed', 'active', 'waiting', 'waiting-children', 'unknown'.
     */
    getState(): Promise<JobState | 'unknown'>;
    /**
     * Change delay of a delayed job.
     *
     * Reschedules a delayed job by setting a new delay from the current time.
     * For example, calling changeDelay(5000) will reschedule the job to execute
     * 5000 milliseconds (5 seconds) from now, regardless of the original delay.
     *
     * @param delay - milliseconds from now when the job should be processed.
     * @returns void
     * @throws JobNotExist
     * This exception is thrown if jobId is missing.
     * @throws JobNotInState
     * This exception is thrown if job is not in delayed state.
     */
    changeDelay(delay: number): Promise<void>;
    /**
     * Change job priority.
     *
     * @param opts - options containing priority and lifo values.
     * @returns void
     */
    changePriority(opts: {
        priority?: number;
        lifo?: boolean;
    }): Promise<void>;
    /**
     * Get this jobs children result values if any.
     *
     * @returns Object mapping children job keys with their values.
     */
    getChildrenValues<CT = any>(): Promise<{
        [jobKey: string]: CT;
    }>;
    /**
     * Retrieves the failures of child jobs that were explicitly ignored while using ignoreDependencyOnFailure option.
     * This method is useful for inspecting which child jobs were intentionally ignored when an error occurred.
     * @see {@link https://docs.bullmq.io/guide/flows/ignore-dependency}
     *
     * @returns Object mapping children job keys with their failure values.
     */
    getIgnoredChildrenFailures(): Promise<{
        [jobKey: string]: string;
    }>;
    /**
     * Get job's children failure values that were ignored if any.
     *
     * @deprecated This method is deprecated and will be removed in v6. Use getIgnoredChildrenFailures instead.
     *
     * @returns Object mapping children job keys with their failure values.
     */
    getFailedChildrenValues(): Promise<{
        [jobKey: string]: string;
    }>;
    /**
     * Get children job keys if this job is a parent and has children.
     * @remarks
     * Count options before Redis v7.2 works as expected with any quantity of entries
     * on processed/unprocessed dependencies, since v7.2 you must consider that count
     * won't have any effect until processed/unprocessed dependencies have a length
     * greater than 127
     * @see {@link https://redis.io/docs/management/optimization/memory-optimization/#redis--72}
     * @see {@link https://docs.bullmq.io/guide/flows#getters}
     * @returns dependencies separated by processed, unprocessed, ignored and failed.
     */
    getDependencies(opts?: DependenciesOpts): Promise<{
        nextFailedCursor?: number;
        failed?: string[];
        nextIgnoredCursor?: number;
        ignored?: Record<string, any>;
        nextProcessedCursor?: number;
        processed?: Record<string, any>;
        nextUnprocessedCursor?: number;
        unprocessed?: string[];
    }>;
    /**
     * Get children job counts if this job is a parent and has children.
     *
     * @returns dependencies count separated by processed, unprocessed, ignored and failed.
     */
    getDependenciesCount(opts?: {
        failed?: boolean;
        ignored?: boolean;
        processed?: boolean;
        unprocessed?: boolean;
    }): Promise<{
        failed?: number;
        ignored?: number;
        processed?: number;
        unprocessed?: number;
    }>;
    /**
     * Returns a promise the resolves when the job has completed (containing the return value of the job),
     * or rejects when the job has failed (containing the failedReason).
     *
     * @param queueEvents - Instance of QueueEvents.
     * @param ttl - Time in milliseconds to wait for job to finish before timing out.
     */
    waitUntilFinished(queueEvents: QueueEvents, ttl?: number): Promise<ReturnType>;
    /**
     * Moves the job to the delay set.
     *
     * @param timestamp - timestamp when the job should be moved back to "wait"
     * @param token - token to check job is locked by current worker
     * @returns
     */
    moveToDelayed(timestamp: number, token?: string): Promise<void>;
    /**
     * Moves the job to the waiting-children set.
     *
     * @param token - Token to check job is locked by current worker
     * @param opts - The options bag for moving a job to waiting-children.
     * @returns true if the job was moved
     */
    moveToWaitingChildren(token: string, opts?: MoveToWaitingChildrenOpts): Promise<boolean>;
    /**
     * Promotes a delayed job so that it starts to be processed as soon as possible.
     */
    promote(): Promise<void>;
    /**
     * Attempts to retry the job. Only a job that has failed or completed can be retried.
     *
     * @param state - completed / failed
     * @param opts - options to retry a job
     * @returns A promise that resolves when the job has been successfully moved to the wait queue.
     * The queue emits a waiting event when the job is successfully moved.
     * @throws Will throw an error if the job does not exist, is locked, or is not in the expected state.
     */
    retry(state?: FinishedStatus, opts?: RetryOptions): Promise<void>;
    /**
     * Marks a job to not be retried if it fails (even if attempts has been configured)
     * @deprecated use UnrecoverableError
     */
    discard(): void;
    private isInZSet;
    private isInList;
    /**
     * Adds the job to Redis.
     *
     * @param client - The Redis client to use for adding the job.
     * @param parentOpts - Options for the parent-child relationship.
     * @returns The job ID
     */
    addJob(client: RedisClient | IRedisTransaction, parentOpts?: ParentKeyOpts): Promise<string>;
    /**
     * Removes a deduplication key if job is still the cause of deduplication.
     * @returns true if the deduplication key was removed.
     */
    removeDeduplicationKey(): Promise<boolean>;
    protected validateOptions(jobData: JobJson): void;
    protected updateStacktrace(err: Error): void;
    private setSpanJobAttributes;
}
