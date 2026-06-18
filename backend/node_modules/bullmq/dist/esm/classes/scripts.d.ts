/**
 * Includes all the scripts needed by the queue and jobs.
 */
import { JobJson, JobJsonRaw, MinimalJob, MoveToWaitingChildrenOpts, ParentKeyOpts, RedisClient, MoveToDelayedOpts, RepeatableOptions, RetryJobOpts, RetryOptions, ScriptQueueContext } from '../interfaces';
import { JobsOptions, JobState, JobType, FinishedStatus, FinishedPropValAttribute, KeepJobs, RedisJobOptions, JobProgress } from '../types';
import { IRedisTransaction } from '../interfaces';
export type JobData = [JobJsonRaw | number, string?];
export declare class Scripts {
    protected queue: ScriptQueueContext;
    protected version: string;
    moveToFinishedKeys: (string | undefined)[];
    constructor(queue: ScriptQueueContext);
    /**
     * Executes a registered Lua script on the given Redis client, resolving the
     * versioned command name (e.g. `addJob:<packageVersion>`) so the script
     * belonging to the current BullMQ version is invoked.
     *
     * @param client - The Redis client or pipeline/transaction on which to run the command.
     * @param commandName - The base name of the Lua script (without version suffix).
     * @param args - Positional arguments forwarded to the Lua script (keys followed by argv).
     * @returns The raw result produced by the Lua script.
     *
     * @private
     */
    execCommand(client: RedisClient | IRedisTransaction, commandName: string, args: any[]): any;
    /**
     * Checks whether a job with the given id is present in a Redis list
     * (e.g. the wait or active list). Uses `LPOS` on Redis \>= 6.0.6, and
     * falls back to a Lua script on older versions.
     *
     * @param listKey - The Redis list key to search.
     * @param jobId - The job id to look up in the list.
     * @returns `true` if the job is found in the list, `false` otherwise.
     *
     * @private
     */
    isJobInList(listKey: string, jobId: string): Promise<boolean>;
    protected addDelayedJobArgs(job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): (string | Buffer)[];
    protected addDelayedJob(client: RedisClient | IRedisTransaction, job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): Promise<string | number>;
    protected addPrioritizedJobArgs(job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): (string | Buffer)[];
    protected addPrioritizedJob(client: RedisClient | IRedisTransaction, job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): Promise<string | number>;
    protected addParentJobArgs(job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): (string | Buffer)[];
    protected addParentJob(client: RedisClient | IRedisTransaction, job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): Promise<string | number>;
    protected addStandardJobArgs(job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): (string | Buffer)[];
    protected addStandardJob(client: RedisClient | IRedisTransaction, job: JobJson, encodedOpts: any, args: (string | number | Record<string, any>)[]): Promise<string | number>;
    addJob(client: RedisClient | IRedisTransaction, job: JobJson, opts: RedisJobOptions, jobId: string, parentKeyOpts?: ParentKeyOpts): Promise<string>;
    protected pauseArgs(pause: boolean): (string | number)[];
    pause(pause: boolean): Promise<void>;
    protected addRepeatableJobArgs(customKey: string, nextMillis: number, opts: RepeatableOptions, legacyCustomKey: string): (string | number | Buffer)[];
    /**
     * Adds (or updates) a repeatable job entry in the repeat zset and stores
     * its repeat options under the corresponding repeat hash. If a previous
     * delayed iteration for this repeat key exists, it is cleaned up so the
     * next iteration can be scheduled separately when the job is created.
     *
     * @param customKey - The current repeat key identifying this repeatable job.
     * @param nextMillis - The timestamp (ms since epoch) for the next run.
     * @param opts - Repeatable options (cron/every pattern, tz, limit, etc.).
     * @param legacyCustomKey - The previous/legacy repeat key, used for migration and cleanup.
     * @returns The repeatable job key that was stored (either `customKey` or,
     * for backwards-compatible entries, `legacyCustomKey`). The actual delayed
     * iteration is scheduled later when the job for `nextMillis` is created.
     *
     * @private
     */
    addRepeatableJob(customKey: string, nextMillis: number, opts: RepeatableOptions, legacyCustomKey: string): Promise<string>;
    /**
     * Removes a deduplication key from Redis so that a new job with the same
     * deduplication id can be enqueued again. The key is only removed if it
     * currently maps to the provided `jobId`, preventing races between
     * producers and finishing jobs.
     *
     * @param deduplicationId - The deduplication id whose key should be cleared.
     * @param jobId - The id of the job that currently owns the dedup key.
     * @returns `1` if the key was removed, `0` otherwise.
     *
     * @private
     */
    removeDeduplicationKey(deduplicationId: string, jobId: string): Promise<number>;
    /**
     * Registers a job scheduler and enqueues its next delayed iteration.
     * The scheduler stores the template data/options so subsequent iterations
     * can be produced automatically based on the repeat options.
     *
     * @param jobSchedulerId - The id that uniquely identifies this scheduler.
     * @param nextMillis - Timestamp (ms since epoch) for the next iteration.
     * @param templateData - Serialized template data reused for every iteration.
     * @param templateOpts - Redis-encoded job options applied to every iteration.
     * @param opts - Repeat options describing the scheduling pattern.
     * @param delayedJobOpts - Options applied to the next delayed job that is produced.
     * @param producerId - Optional id of the job that produced this iteration, used to prevent duplicates.
     * @returns A tuple of `[jobId, delay]`, where `delay` is the computed delay in milliseconds
     * for the next iteration. When `delay` is `0`, the job is enqueued immediately.
     * @throws An error resolved from `finishedErrors` when the Lua script returns a negative status code.
     *
     * @private
     */
    addJobScheduler(jobSchedulerId: string, nextMillis: number, templateData: string, templateOpts: RedisJobOptions, opts: RepeatableOptions, delayedJobOpts: JobsOptions, producerId?: string): Promise<[string, number]>;
    updateRepeatableJobMillis(client: RedisClient, customKey: string, nextMillis: number, legacyCustomKey: string): Promise<string>;
    updateJobSchedulerNextMillis(jobSchedulerId: string, nextMillis: number, templateData: string, delayedJobOpts: JobsOptions, producerId?: string): Promise<string | null>;
    private removeRepeatableArgs;
    getRepeatConcatOptions(repeatConcatOptions: string, repeatJobKey: string): string;
    removeRepeatable(legacyRepeatJobId: string, repeatConcatOptions: string, repeatJobKey: string): Promise<number>;
    removeJobScheduler(jobSchedulerId: string): Promise<number>;
    protected removeArgs(jobId: string, removeChildren: boolean): (string | number)[];
    remove(jobId: string, removeChildren: boolean): Promise<number>;
    removeUnprocessedChildren(jobId: string): Promise<void>;
    extendLock(jobId: string, token: string, duration: number, client?: RedisClient | IRedisTransaction): Promise<number>;
    extendLocks(jobIds: string[], tokens: string[], duration: number): Promise<string[]>;
    updateData<T = any, R = any, N extends string = string>(job: MinimalJob<T, R, N>, data: T): Promise<void>;
    updateProgress(jobId: string, progress: JobProgress): Promise<void>;
    addLog(jobId: string, logRow: string, keepLogs?: number): Promise<number>;
    protected moveToFinishedArgs<T = any, R = any, N extends string = string>(job: MinimalJob<T, R, N>, val: any, propVal: FinishedPropValAttribute, shouldRemove: undefined | boolean | number | KeepJobs, target: FinishedStatus, token: string, timestamp: number, fetchNext?: boolean, fieldsToUpdate?: Record<string, any>): (string | number | boolean | Buffer)[];
    protected getKeepJobs(shouldRemove: undefined | boolean | number | KeepJobs, workerKeepJobs: undefined | KeepJobs): KeepJobs;
    moveToFinished(jobId: string, args: (string | number | boolean | Buffer)[]): Promise<any[]>;
    private drainArgs;
    drain(delayed: boolean): Promise<void>;
    private removeChildDependencyArgs;
    removeChildDependency(jobId: string, parentKey: string): Promise<boolean>;
    private getRangesArgs;
    getRanges(types: JobType[], start?: number, end?: number, asc?: boolean): Promise<[string][]>;
    private getCountsArgs;
    getCounts(types: JobType[]): Promise<number[]>;
    protected getCountsPerPriorityArgs(priorities: number[]): (string | number)[];
    getCountsPerPriority(priorities: number[]): Promise<number[]>;
    protected getDependencyCountsArgs(jobId: string, types: string[]): (string | number)[];
    getDependencyCounts(jobId: string, types: string[]): Promise<number[]>;
    moveToCompletedArgs<T = any, R = any, N extends string = string>(job: MinimalJob<T, R, N>, returnvalue: R, removeOnComplete: boolean | number | KeepJobs, token: string, fetchNext?: boolean): (string | number | boolean | Buffer)[];
    moveToFailedArgs<T = any, R = any, N extends string = string>(job: MinimalJob<T, R, N>, failedReason: string, removeOnFailed: boolean | number | KeepJobs, token: string, fetchNext?: boolean, fieldsToUpdate?: Record<string, any>): (string | number | boolean | Buffer)[];
    isFinished(jobId: string, returnValue?: boolean): Promise<number | [number, string]>;
    getState(jobId: string): Promise<JobState | 'unknown'>;
    /**
     * Change delay of a delayed job.
     *
     * Reschedules a delayed job by setting a new delay from the current time.
     * For example, calling changeDelay(5000) will reschedule the job to execute
     * 5000 milliseconds (5 seconds) from now, regardless of the original delay.
     *
     * @param jobId - the ID of the job to change the delay for.
     * @param delay - milliseconds from now when the job should be processed.
     * @returns delay in milliseconds.
     * @throws JobNotExist
     * This exception is thrown if jobId is missing.
     * @throws JobNotInState
     * This exception is thrown if job is not in delayed state.
     */
    changeDelay(jobId: string, delay: number): Promise<void>;
    private changeDelayArgs;
    changePriority(jobId: string, priority?: number, lifo?: boolean): Promise<void>;
    protected changePriorityArgs(jobId: string, priority?: number, lifo?: boolean): (string | number)[];
    moveToDelayedArgs(jobId: string, timestamp: number, token: string, delay: number, opts?: MoveToDelayedOpts): (string | number | Buffer)[];
    moveToWaitingChildrenArgs(jobId: string, token: string, opts?: MoveToWaitingChildrenOpts): (string | number)[];
    isMaxedArgs(): string[];
    isMaxed(): Promise<boolean>;
    moveToDelayed(jobId: string, timestamp: number, delay: number, token?: string, opts?: MoveToDelayedOpts): Promise<void | any[]>;
    /**
     * Move parent job to waiting-children state.
     *
     * @returns true if job is successfully moved, false if there are pending dependencies.
     * @throws JobNotExist
     * This exception is thrown if jobId is missing.
     * @throws JobLockNotExist
     * This exception is thrown if job lock is missing.
     * @throws JobNotInState
     * This exception is thrown if job is not in active state.
     */
    moveToWaitingChildren(jobId: string, token: string, opts?: MoveToWaitingChildrenOpts): Promise<boolean>;
    getRateLimitTtlArgs(maxJobs?: number): (string | number)[];
    getRateLimitTtl(maxJobs?: number): Promise<number>;
    /**
     * Remove jobs in a specific state.
     *
     * @returns Id jobs from the deleted records.
     */
    cleanJobsInSet(set: string, timestamp: number, limit?: number): Promise<string[]>;
    getJobSchedulerArgs(id: string): string[];
    getJobScheduler(id: string): Promise<[any, string | null]>;
    retryJobArgs(jobId: string, lifo: boolean, token: string, opts?: MoveToDelayedOpts): (string | number | Buffer)[];
    retryJob(jobId: string, lifo: boolean, token?: string, opts?: RetryJobOpts): Promise<void>;
    protected moveJobsToWaitArgs(state: FinishedStatus | 'delayed', count: number, timestamp: number): (string | number)[];
    retryJobs(state?: FinishedStatus, count?: number, timestamp?: number): Promise<number>;
    promoteJobs(count?: number): Promise<number>;
    /**
     * Attempts to reprocess a job
     *
     * @param job - The job to reprocess
     * @param state - The expected job state. If the job is not found
     * on the provided state, then it's not reprocessed. Supported states: 'failed', 'completed'
     *
     * @returns A promise that resolves when the job has been successfully moved to the wait queue.
     * @throws Will throw an error with a code property indicating the failure reason:
     *   - code 0: Job does not exist
     *   - code -1: Job is currently locked and can't be retried
     *   - code -2: Job was not found in the expected set
     */
    reprocessJob<T = any, R = any, N extends string = string>(job: MinimalJob<T, R, N>, state: 'failed' | 'completed', opts?: RetryOptions): Promise<void>;
    getMetrics(type: 'completed' | 'failed', start?: number, end?: number): Promise<[string[], string[], number]>;
    moveToActive(client: RedisClient, token: string, name?: string): Promise<any[]>;
    promote(jobId: string): Promise<void>;
    protected moveStalledJobsToWaitArgs(): (string | number)[];
    /**
     * Looks for unlocked jobs in the active queue.
     *
     * The job was being worked on, but the worker process died and it failed to renew the lock.
     * We call these jobs 'stalled'. This is the most common case. We resolve these by moving them
     * back to wait to be re-processed. To prevent jobs from cycling endlessly between active and wait,
     * (e.g. if the job handler keeps crashing),
     * we limit the number stalled job recoveries to settings.maxStalledCount.
     */
    moveStalledJobsToWait(): Promise<string[]>;
    /**
     * Moves a job back from Active to Wait.
     * This script is used when a job has been manually rate limited and needs
     * to be moved back to wait from active status.
     *
     * @param client - Redis client
     * @param jobId - Job id
     * @returns
     */
    moveJobFromActiveToWait(jobId: string, token?: string): Promise<any>;
    obliterate(opts: {
        force: boolean;
        count: number;
    }): Promise<number>;
    /**
     * Paginate a set or hash keys.
     * @param opts - options to define the pagination behaviour
     *
     */
    paginate(key: string, opts: {
        start: number;
        end: number;
        fetchJobs?: boolean;
    }): Promise<{
        cursor: string;
        items: {
            id: string;
            v?: any;
            err?: string;
        }[];
        total: number;
        jobs?: JobJsonRaw[];
    }>;
    finishedErrors({ code, jobId, parentKey, command, state, }: {
        code: number;
        jobId?: string;
        parentKey?: string;
        command: string;
        state?: string;
    }): Error;
    removeOrphanedJobs(candidateJobIds: string[], stateKeySuffixes: string[], jobSubKeySuffixes: string[]): Promise<number>;
}
export declare function raw2NextJobData(raw: any[]): any[];
