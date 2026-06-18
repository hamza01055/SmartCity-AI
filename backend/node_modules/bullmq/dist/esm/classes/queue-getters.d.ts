import { QueueBase } from './queue-base';
import { Job } from './job';
import { JobState, JobType } from '../types';
import { JobJsonRaw, Metrics, QueueMeta } from '../interfaces';
/**
 * Provides different getters for different aspects of a queue.
 */
export declare class QueueGetters<JobBase extends Job = Job> extends QueueBase {
    getJob(jobId: string): Promise<JobBase | undefined>;
    private commandByType;
    private sanitizeJobTypes;
    /**
      Returns the number of jobs waiting to be processed. This includes jobs that are
      "waiting" or "delayed" or "prioritized" or "waiting-children".
    */
    count(): Promise<number>;
    /**
     * Returns the time to live for a rate limited key in milliseconds.
     * @param maxJobs - max jobs to be considered in rate limit state. If not passed
     * it will return the remaining ttl without considering if max jobs is exceeded.
     * @returns -2 if the key does not exist.
     * -1 if the key exists but has no associated expire.
     * @see {@link https://redis.io/commands/pttl/}
     */
    getRateLimitTtl(maxJobs?: number): Promise<number>;
    /**
     * Get jobId that starts debounced state.
     * @deprecated use getDeduplicationJobId method
     *
     * @param id - debounce identifier
     */
    getDebounceJobId(id: string): Promise<string | null>;
    /**
     * Get jobId from deduplicated state.
     *
     * @param id - deduplication identifier
     */
    getDeduplicationJobId(id: string): Promise<string | null>;
    /**
     * Get global concurrency value.
     * Returns null in case no value is set.
     */
    getGlobalConcurrency(): Promise<number | null>;
    /**
     * Get global rate limit values.
     * Returns null in case no value is set.
     */
    getGlobalRateLimit(): Promise<{
        max: number;
        duration: number;
    } | null>;
    /**
     * Job counts by type
     *
     * Queue#getJobCountByTypes('completed') =\> completed count
     * Queue#getJobCountByTypes('completed', 'failed') =\> completed + failed count
     * Queue#getJobCountByTypes('completed', 'waiting', 'failed') =\> completed + waiting + failed count
     */
    getJobCountByTypes(...types: JobType[]): Promise<number>;
    /**
     * Returns the job counts for each type specified or every list/set in the queue by default.
     * @param types - the types of jobs to count. If not specified, it will return the counts for all types.
     * @returns An object, key (type) and value (count)
     */
    getJobCounts(...types: JobType[]): Promise<{
        [index: string]: number;
    }>;
    /**
     * Records job counts as gauge metrics for telemetry purposes.
     * Each job state count is recorded with the queue name and state as attributes.
     * @param types - the types of jobs to count. If not specified, it will return the counts for all types.
     * @returns An object, key (type) and value (count)
     */
    recordJobCountsMetric(...types: JobType[]): Promise<{
        [index: string]: number;
    }>;
    /**
     * Get current job state.
     *
     * @param jobId - job identifier.
     * @returns Returns one of these values:
     * 'completed', 'failed', 'delayed', 'active', 'waiting', 'waiting-children', 'unknown'.
     */
    getJobState(jobId: string): Promise<JobState | 'unknown'>;
    /**
     * Get global queue configuration.
     *
     * @returns Returns the global queue configuration.
     */
    getMeta(): Promise<QueueMeta>;
    /**
     * @returns Returns the number of jobs in completed status.
     */
    getCompletedCount(): Promise<number>;
    /**
     * Returns the number of jobs in failed status.
     */
    getFailedCount(): Promise<number>;
    /**
     * Returns the number of jobs in delayed status.
     */
    getDelayedCount(): Promise<number>;
    /**
     * Returns the number of jobs in active status.
     */
    getActiveCount(): Promise<number>;
    /**
     * Returns the number of jobs in prioritized status.
     */
    getPrioritizedCount(): Promise<number>;
    /**
     * Returns the number of jobs per priority.
     */
    getCountsPerPriority(priorities: number[]): Promise<{
        [index: string]: number;
    }>;
    /**
     * Returns the number of jobs in waiting or paused statuses.
     */
    getWaitingCount(): Promise<number>;
    /**
     * Returns the number of jobs in waiting-children status.
     */
    getWaitingChildrenCount(): Promise<number>;
    /**
     * Returns the jobs that are in the "waiting" status.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     */
    getWaiting(start?: number, end?: number): Promise<JobBase[]>;
    /**
     * Returns the jobs that are in the "waiting-children" status.
     * I.E. parent jobs that have at least one child that has not completed yet.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     */
    getWaitingChildren(start?: number, end?: number): Promise<JobBase[]>;
    /**
     * Returns the jobs that are in the "active" status.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     */
    getActive(start?: number, end?: number): Promise<JobBase[]>;
    /**
     * Returns the jobs that are in the "delayed" status.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     */
    getDelayed(start?: number, end?: number): Promise<JobBase[]>;
    /**
     * Returns the jobs that are in the "prioritized" status.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     */
    getPrioritized(start?: number, end?: number): Promise<JobBase[]>;
    /**
     * Returns the jobs that are in the "completed" status.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     */
    getCompleted(start?: number, end?: number): Promise<JobBase[]>;
    /**
     * Returns the jobs that are in the "failed" status.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     */
    getFailed(start?: number, end?: number): Promise<JobBase[]>;
    /**
     * Returns the qualified job ids and the raw job data (if available) of the
     * children jobs of the given parent job.
     * It is possible to get either the already processed children, in this case
     * an array of qualified job ids and their result values will be returned,
     * or the pending children, in this case an array of qualified job ids will
     * be returned.
     * A qualified job id is a string representing the job id in a given queue,
     * for example: "bull:myqueue:jobid".
     *
     * @param parentId - The id of the parent job
     * @param type - "processed" | "pending"
     * @param opts - Options for the query.
     *
     * @returns an object with the following shape:
     * `{ items: { id: string, v?: any, err?: string } [], jobs: JobJsonRaw[], total: number}`
     */
    getDependencies(parentId: string, type: 'processed' | 'pending', start: number, end: number): Promise<{
        items: {
            id: string;
            v?: any;
            err?: string;
        }[];
        jobs: JobJsonRaw[];
        total: number;
    }>;
    getRanges(types: JobType[], start?: number, end?: number, asc?: boolean): Promise<string[]>;
    /**
     * Returns the jobs that are on the given statuses (note that JobType is synonym for job status)
     * @param types - the statuses of the jobs to return.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     * @param asc - if true, the jobs will be returned in ascending order.
     */
    getJobs(types?: JobType[] | JobType, start?: number, end?: number, asc?: boolean): Promise<JobBase[]>;
    /**
     * Returns the logs for a given Job.
     * @param jobId - the id of the job to get the logs for.
     * @param start - zero based index from where to start returning jobs.
     * @param end - zero based index where to stop returning jobs.
     * @param asc - if true, the jobs will be returned in ascending order.
     */
    getJobLogs(jobId: string, start?: number, end?: number, asc?: boolean): Promise<{
        logs: string[];
        count: number;
    }>;
    private baseGetClients;
    /**
     * Get the worker list related to the queue. i.e. all the known
     * workers that are available to process jobs for this queue.
     * Note: GCP does not support SETNAME, so this call will not work
     *
     * @returns - Returns an array with workers info.
     */
    getWorkers(): Promise<{
        [index: string]: string;
    }[]>;
    /**
     * Returns the current count of workers for the queue.
     *
     * getWorkersCount(): Promise<number>
     *
     */
    getWorkersCount(): Promise<number>;
    /**
     * Get queue events list related to the queue.
     * Note: GCP does not support SETNAME, so this call will not work
     *
     * @deprecated do not use this method, it will be removed in the future.
     *
     * @returns - Returns an array with queue events info.
     */
    getQueueEvents(): Promise<{
        [index: string]: string;
    }[]>;
    /**
     * Get queue metrics related to the queue.
     *
     * This method returns the gathered metrics for the queue.
     * The metrics are represented as an array of job counts
     * per unit of time (1 minute).
     *
     * @param start - Start point of the metrics, where 0
     * is the newest point to be returned.
     * @param end - End point of the metrics, where -1 is the
     * oldest point to be returned.
     *
     * @returns - Returns an object with queue metrics.
     */
    getMetrics(type: 'completed' | 'failed', start?: number, end?: number): Promise<Metrics>;
    private parseClientList;
    /**
     * Export the metrics for the queue in the Prometheus format.
     * Automatically exports all the counts returned by getJobCounts().
     *
     * @returns - Returns a string with the metrics in the Prometheus format.
     *
     * @see {@link https://prometheus.io/docs/instrumenting/exposition_formats/}
     *
     **/
    exportPrometheusMetrics(globalVariables?: Record<string, string>): Promise<string>;
}
