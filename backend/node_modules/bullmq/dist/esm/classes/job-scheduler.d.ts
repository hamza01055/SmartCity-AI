import { JobSchedulerJson, RepeatBaseOptions, RepeatOptions } from '../interfaces';
import { JobSchedulerTemplateOptions } from '../types';
import { Job } from './job';
import { QueueBase } from './queue-base';
import { RedisConnection } from './redis-connection';
export declare class JobScheduler extends QueueBase {
    private repeatStrategy;
    constructor(name: string, opts: RepeatBaseOptions, Connection?: typeof RedisConnection);
    upsertJobScheduler<T = any, R = any, N extends string = string>(jobSchedulerId: string, repeatOpts: Omit<RepeatOptions, 'key' | 'prevMillis'>, jobName: N, jobData: T, opts: JobSchedulerTemplateOptions, { override, producerId }: {
        override: boolean;
        producerId?: string;
    }): Promise<Job<T, R, N> | undefined>;
    private getNextJobOpts;
    removeJobScheduler(jobSchedulerId: string): Promise<number>;
    private getSchedulerData;
    private transformSchedulerData;
    private keyToData;
    /**
     * Checks if a given id corresponds to a registered job scheduler.
     *
     * This is used to disambiguate between new job scheduler ids (which may
     * contain any number of colon segments) and legacy repeatable job keys
     * (which always contain 5+ colon segments). Relying purely on segment
     * count is not safe because a user-provided jobSchedulerId may itself
     * contain 5+ colon segments, which would otherwise be misclassified as
     * a legacy repeatable key.
     *
     * We cannot use ZSCORE on the shared `repeat` sorted set because legacy
     * repeatable jobs are stored in the same sorted set and would be reported
     * as schedulers. Instead, we probe the per-id metadata hash (`repeat:<id>`)
     * for the `ic` (iteration count) field, which is written exclusively by
     * `storeJobScheduler` and is never set by the legacy `addRepeatableJob`
     * flow.
     */
    isJobScheduler(id: string): Promise<boolean>;
    getScheduler<D = any>(id: string): Promise<JobSchedulerJson<D> | undefined>;
    private getTemplateFromJSON;
    getJobSchedulers<D = any>(start?: number, end?: number, asc?: boolean): Promise<JobSchedulerJson<D>[]>;
    getSchedulersCount(): Promise<number>;
    private getSchedulerNextJobId;
}
export declare const defaultRepeatStrategy: (millis: number, opts: RepeatOptions) => number | undefined;
