import { URL } from 'url';
import { AbortController } from './abort-controller';
import { GetNextJobOptions, IoredisListener, JobJsonRaw, RedisClient, Span, WorkerOptions } from '../interfaces';
import { JobProgress } from '../types';
import { Processor } from '../types/processor';
import { QueueBase } from './queue-base';
import { Repeat } from './repeat';
import { Job } from './job';
import { RedisConnection } from './redis-connection';
import { JobScheduler } from './job-scheduler';
import { LockManager } from './lock-manager';
export interface WorkerListener<DataType = any, ResultType = any, NameType extends string = string> extends IoredisListener {
    /**
     * Listen to 'active' event.
     *
     * This event is triggered when a job enters the 'active' state.
     */
    active: (job: Job<DataType, ResultType, NameType>, prev: string) => void;
    /**
     * Listen to 'closed' event.
     *
     * This event is triggered when the worker is closed.
     */
    closed: () => void;
    /**
     * Listen to 'closing' event.
     *
     * This event is triggered when the worker is closing.
     */
    closing: (msg: string) => void;
    /**
     * Listen to 'completed' event.
     *
     * This event is triggered when a job has successfully completed.
     */
    completed: (job: Job<DataType, ResultType, NameType>, result: ResultType, prev: string) => void;
    /**
     * Listen to 'drained' event.
     *
     * This event is triggered when the queue has drained the waiting list.
     * Note that there could still be delayed jobs waiting their timers to expire
     * and this event will still be triggered as long as the waiting list has emptied.
     */
    drained: () => void;
    /**
     * Listen to 'error' event.
     *
     * This event is triggered when an error is throw.
     */
    error: (failedReason: Error) => void;
    /**
     * Listen to 'failed' event.
     *
     * This event is triggered when a job has thrown an exception.
     * Note: job parameter could be received as undefined when an stalled job
     * reaches the stalled limit and it is deleted by the removeOnFail option.
     */
    failed: (job: Job<DataType, ResultType, NameType> | undefined, error: Error, prev: string) => void;
    /**
     * Listen to 'paused' event.
     *
     * This event is triggered when the queue is paused.
     */
    paused: () => void;
    /**
     * Listen to 'progress' event.
     *
     * This event is triggered when a job updates it progress, i.e. the
     * Job##updateProgress() method is called. This is useful to notify
     * progress or any other data from within a processor to the rest of the
     * world.
     */
    progress: (job: Job<DataType, ResultType, NameType>, progress: JobProgress) => void;
    /**
     * Listen to 'ready' event.
     *
     * This event is triggered when blockingConnection is ready.
     */
    ready: () => void;
    /**
     * Listen to 'resumed' event.
     *
     * This event is triggered when the queue is resumed.
     */
    resumed: () => void;
    /**
     * Listen to 'stalled' event.
     *
     * This event is triggered when a job has stalled and
     * has been moved back to the wait list.
     */
    stalled: (jobId: string, prev: string) => void;
    /**
     * Listen to 'lockRenewalFailed' event.
     *
     * This event is triggered when lock renewal fails for one or more jobs.
     */
    lockRenewalFailed: (jobIds: string[]) => void;
    /**
     * Listen to 'locksRenewed' event.
     *
     * This event is triggered when locks are successfully renewed.
     */
    locksRenewed: (data: {
        count: number;
        jobIds: string[];
    }) => void;
}
/**
 *
 * This class represents a worker that is able to process jobs from the queue.
 * As soon as the class is instantiated and a connection to Redis is established
 * it will start processing jobs.
 *
 */
export declare class Worker<DataType = any, ResultType = any, NameType extends string = string> extends QueueBase {
    readonly opts: WorkerOptions;
    readonly id: string;
    private abortDelayController;
    private blockingConnection;
    private blockUntil;
    private _concurrency;
    private childPool;
    private drained;
    private limitUntil;
    protected lockManager: LockManager;
    private processorAcceptsSignal;
    private stalledCheckerRunning;
    private stalledCheckStopper?;
    private waiting;
    private _repeat;
    protected _jobScheduler: JobScheduler;
    protected paused: boolean;
    protected processFn: Processor<DataType, ResultType, NameType>;
    protected running: boolean;
    protected mainLoopRunning: Promise<void> | null;
    static RateLimitError(): Error;
    constructor(name: string, processor?: string | URL | null | Processor<DataType, ResultType, NameType>, opts?: WorkerOptions, Connection?: typeof RedisConnection);
    /**
     * Creates and configures the lock manager for processing jobs.
     * This method can be overridden in subclasses to customize lock manager behavior.
     */
    protected createLockManager(): void;
    /**
     * Creates and configures the sandbox for processing jobs.
     * This method can be overridden in subclasses to customize sandbox behavior.
     *
     * @param processor - The processor file path, URL, or function to be sandboxed
     */
    protected createSandbox(processor: string | URL | null | Processor<DataType, ResultType, NameType>): void;
    /**
     * Public accessor method for LockManager to extend locks.
     * This delegates to the protected scripts object.
     */
    extendJobLocks(jobIds: string[], tokens: string[], duration: number): Promise<string[]>;
    emit<U extends keyof WorkerListener<DataType, ResultType, NameType>>(event: U, ...args: Parameters<WorkerListener<DataType, ResultType, NameType>[U]>): boolean;
    off<U extends keyof WorkerListener<DataType, ResultType, NameType>>(eventName: U, listener: WorkerListener<DataType, ResultType, NameType>[U]): this;
    on<U extends keyof WorkerListener<DataType, ResultType, NameType>>(event: U, listener: WorkerListener<DataType, ResultType, NameType>[U]): this;
    once<U extends keyof WorkerListener<DataType, ResultType, NameType>>(event: U, listener: WorkerListener<DataType, ResultType, NameType>[U]): this;
    protected callProcessJob(job: Job<DataType, ResultType, NameType>, token: string, signal?: AbortSignal): Promise<ResultType>;
    protected createJob(data: JobJsonRaw, jobId: string): Job<DataType, ResultType, NameType>;
    /**
     *
     * Waits until the worker is ready to start processing jobs.
     * In general only useful when writing tests.
     *
     */
    waitUntilReady(): Promise<RedisClient>;
    /**
     * Cancels a specific job currently being processed by this worker.
     * The job's processor function will receive an abort signal.
     *
     * @param jobId - The ID of the job to cancel
     * @param reason - Optional reason for the cancellation
     * @returns true if the job was found and cancelled, false otherwise
     */
    cancelJob(jobId: string, reason?: string): boolean;
    /**
     * Cancels all jobs currently being processed by this worker.
     * All active job processor functions will receive abort signals.
     *
     * @param reason - Optional reason for the cancellation
     */
    cancelAllJobs(reason?: string): void;
    set concurrency(concurrency: number);
    get concurrency(): number;
    get repeat(): Promise<Repeat>;
    get jobScheduler(): Promise<JobScheduler>;
    run(): Promise<void>;
    private waitForRateLimit;
    /**
     * This is the main loop in BullMQ. Its goals are to fetch jobs from the queue
     * as efficiently as possible, providing concurrency and minimal unnecessary calls
     * to Redis.
     */
    private mainLoop;
    /**
     * Returns a promise that resolves to the next job in queue.
     * @param token - worker token to be assigned to retrieved job
     * @returns a Job or undefined if no job was available in the queue.
     */
    getNextJob(token: string, { block }?: GetNextJobOptions): Promise<Job<DataType, ResultType, NameType>>;
    private _getNextJob;
    /**
     * Overrides the rate limit to be active for the next jobs.
     * @deprecated This method is deprecated and will be removed in v6. Use queue.rateLimit method instead.
     * @param expireTimeMs - expire time in ms of this rate limit.
     */
    rateLimit(expireTimeMs: number): Promise<void>;
    get minimumBlockTimeout(): number;
    private isRateLimited;
    protected moveToActive(client: RedisClient, token: string, name?: string): Promise<Job<DataType, ResultType, NameType>>;
    private waitForJob;
    protected getBlockTimeout(blockUntil: number): number;
    protected getRateLimitDelay(delay: number): number;
    /**
     *
     * This function is exposed only for testing purposes.
     */
    delay(milliseconds?: number, abortController?: AbortController): Promise<void>;
    private updateDelays;
    protected nextJobFromJobData(jobData?: JobJsonRaw, jobId?: string, token?: string): Promise<Job<DataType, ResultType, NameType>>;
    processJob(job: Job<DataType, ResultType, NameType>, token: string, fetchNextCallback?: () => boolean): Promise<void | Job<DataType, ResultType, NameType>>;
    private getUnrecoverableErrorMessage;
    protected handleCompleted(result: ResultType, job: Job<DataType, ResultType, NameType>, token: string, fetchNextCallback?: () => boolean, span?: Span): Promise<Job<DataType, ResultType, NameType>>;
    protected handleFailed(err: Error, job: Job<DataType, ResultType, NameType>, token: string, fetchNextCallback?: () => boolean, span?: Span): Promise<Job<DataType, ResultType, NameType>>;
    /**
     *
     * Pauses the processing of this queue only for this worker.
     */
    pause(doNotWaitActive?: boolean): Promise<void>;
    /**
     *
     * Resumes processing of this worker (if paused).
     */
    resume(): void;
    /**
     *
     * Checks if worker is paused.
     *
     * @returns true if worker is paused, false otherwise.
     */
    isPaused(): boolean;
    /**
     *
     * Checks if worker is currently running.
     *
     * @returns true if worker is running, false otherwise.
     */
    isRunning(): boolean;
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
    close(force?: boolean): Promise<void>;
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
    startStalledCheckTimer(): Promise<void>;
    private stalledChecker;
    /**
     * Returns a promise that resolves when active jobs are cleared
     *
     * @returns
     */
    private whenCurrentJobsFinished;
    private retryIfFailed;
    private moveStalledJobsToWait;
    private moveLimitedBackToWait;
}
