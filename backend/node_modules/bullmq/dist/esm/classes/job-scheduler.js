import { __rest } from "tslib";
import { parseExpression } from 'cron-parser';
import { Job } from './job';
import { QueueBase } from './queue-base';
import { SpanKind, TelemetryAttributes } from '../enums';
import { array2obj } from '../utils';
export class JobScheduler extends QueueBase {
    constructor(name, opts, Connection) {
        super(name, opts, Connection);
        this.repeatStrategy =
            (opts.settings && opts.settings.repeatStrategy) || defaultRepeatStrategy;
    }
    async upsertJobScheduler(jobSchedulerId, repeatOpts, jobName, jobData, opts, { override, producerId }) {
        const { every, limit, pattern, offset } = repeatOpts;
        if (pattern && every) {
            throw new Error('Both .pattern and .every options are defined for this repeatable job');
        }
        if (!pattern && !every) {
            throw new Error('Either .pattern or .every options must be defined for this repeatable job');
        }
        if (repeatOpts.immediately && repeatOpts.startDate) {
            throw new Error('Both .immediately and .startDate options are defined for this repeatable job');
        }
        if (repeatOpts.immediately && repeatOpts.every) {
            console.warn("Using option immediately with every does not affect the job's schedule. Job will run immediately anyway.");
        }
        // Check if we reached the limit of the repeatable job's iterations
        const iterationCount = repeatOpts.count ? repeatOpts.count + 1 : 1;
        if (typeof repeatOpts.limit !== 'undefined' &&
            iterationCount > repeatOpts.limit) {
            return;
        }
        // Check if we reached the end date of the repeatable job
        let now = Date.now();
        const { endDate } = repeatOpts;
        if (endDate && now > new Date(endDate).getTime()) {
            return;
        }
        const prevMillis = opts.prevMillis || 0;
        now = prevMillis < now ? now : prevMillis;
        // Check if we have a start date for the repeatable job
        const { immediately } = repeatOpts, filteredRepeatOpts = __rest(repeatOpts, ["immediately"]);
        let nextMillis;
        const newOffset = every && offset ? offset : null;
        if (pattern) {
            nextMillis = await this.repeatStrategy(now, repeatOpts, jobName);
            if (nextMillis < now) {
                nextMillis = now;
            }
        }
        if (nextMillis || every) {
            return this.trace(SpanKind.PRODUCER, 'add', `${this.name}.${jobName}`, async (span, srcPropagationMetadata) => {
                var _a, _b;
                let telemetry = opts.telemetry;
                if (srcPropagationMetadata) {
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
                const mergedOpts = this.getNextJobOpts(nextMillis, jobSchedulerId, Object.assign(Object.assign({}, opts), { repeat: filteredRepeatOpts, telemetry }), iterationCount, newOffset);
                if (override) {
                    // Clamp nextMillis to now if it's in the past
                    if (nextMillis < now) {
                        nextMillis = now;
                    }
                    const [jobId, delay] = await this.scripts.addJobScheduler(jobSchedulerId, nextMillis, JSON.stringify(typeof jobData === 'undefined' ? {} : jobData), Job.optsAsJSON(opts), {
                        name: jobName,
                        startDate: repeatOpts.startDate
                            ? new Date(repeatOpts.startDate).getTime()
                            : undefined,
                        endDate: endDate ? new Date(endDate).getTime() : undefined,
                        tz: repeatOpts.tz,
                        pattern,
                        every,
                        limit,
                        offset: newOffset,
                    }, Job.optsAsJSON(mergedOpts), producerId);
                    // Ensure delay is a number (Dragonflydb may return it as a string)
                    const numericDelay = typeof delay === 'string' ? parseInt(delay, 10) : delay;
                    const job = new this.Job(this, jobName, jobData, Object.assign(Object.assign({}, mergedOpts), { delay: numericDelay }), jobId);
                    job.id = jobId;
                    span === null || span === void 0 ? void 0 : span.setAttributes({
                        [TelemetryAttributes.JobSchedulerId]: jobSchedulerId,
                        [TelemetryAttributes.JobId]: job.id,
                    });
                    return job;
                }
                else {
                    const jobId = await this.scripts.updateJobSchedulerNextMillis(jobSchedulerId, nextMillis, JSON.stringify(typeof jobData === 'undefined' ? {} : jobData), Job.optsAsJSON(mergedOpts), producerId);
                    if (jobId) {
                        const job = new this.Job(this, jobName, jobData, mergedOpts, jobId);
                        job.id = jobId;
                        span === null || span === void 0 ? void 0 : span.setAttributes({
                            [TelemetryAttributes.JobSchedulerId]: jobSchedulerId,
                            [TelemetryAttributes.JobId]: job.id,
                        });
                        return job;
                    }
                }
            });
        }
    }
    getNextJobOpts(nextMillis, jobSchedulerId, opts, currentCount, offset) {
        var _a, _b;
        //
        // Generate unique job id for this iteration.
        //
        const jobId = this.getSchedulerNextJobId({
            jobSchedulerId,
            nextMillis,
        });
        const now = Date.now();
        const delay = nextMillis + offset - now;
        const mergedOpts = Object.assign(Object.assign({}, opts), { jobId, delay: delay < 0 ? 0 : delay, timestamp: now, prevMillis: nextMillis, repeatJobKey: jobSchedulerId });
        mergedOpts.repeat = Object.assign(Object.assign({}, opts.repeat), { offset, count: currentCount, startDate: ((_a = opts.repeat) === null || _a === void 0 ? void 0 : _a.startDate)
                ? new Date(opts.repeat.startDate).getTime()
                : undefined, endDate: ((_b = opts.repeat) === null || _b === void 0 ? void 0 : _b.endDate)
                ? new Date(opts.repeat.endDate).getTime()
                : undefined });
        return mergedOpts;
    }
    async removeJobScheduler(jobSchedulerId) {
        return this.scripts.removeJobScheduler(jobSchedulerId);
    }
    async getSchedulerData(client, key, next) {
        const jobData = await client.hgetall(this.toKey('repeat:' + key));
        return this.transformSchedulerData(key, jobData, next);
    }
    transformSchedulerData(key, jobData, next) {
        if (jobData && Object.keys(jobData).length > 0) {
            const jobSchedulerData = {
                key,
                name: jobData.name,
                next,
            };
            if (jobData.ic) {
                jobSchedulerData.iterationCount = parseInt(jobData.ic);
            }
            if (jobData.limit) {
                jobSchedulerData.limit = parseInt(jobData.limit);
            }
            if (jobData.startDate) {
                jobSchedulerData.startDate = parseInt(jobData.startDate);
            }
            if (jobData.endDate) {
                jobSchedulerData.endDate = parseInt(jobData.endDate);
            }
            if (jobData.tz) {
                jobSchedulerData.tz = jobData.tz;
            }
            if (jobData.pattern) {
                jobSchedulerData.pattern = jobData.pattern;
            }
            if (jobData.every) {
                jobSchedulerData.every = parseInt(jobData.every);
            }
            if (jobData.offset) {
                jobSchedulerData.offset = parseInt(jobData.offset);
            }
            if (jobData.data || jobData.opts) {
                jobSchedulerData.template = this.getTemplateFromJSON(jobData.data, jobData.opts);
            }
            return jobSchedulerData;
        }
        // TODO: remove this check and keyToData as it is here only to support legacy code
        if (key.includes(':')) {
            return this.keyToData(key, next);
        }
    }
    keyToData(key, next) {
        const data = key.split(':');
        const pattern = data.slice(4).join(':') || null;
        return {
            key,
            name: data[0],
            id: data[1] || null,
            endDate: parseInt(data[2]) || null,
            tz: data[3] || null,
            pattern,
            next,
        };
    }
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
    async isJobScheduler(id) {
        const client = await this.client;
        const exists = await client.hexists(`${this.keys.repeat}:${id}`, 'ic');
        return exists === 1;
    }
    async getScheduler(id) {
        const [rawJobData, next] = await this.scripts.getJobScheduler(id);
        return this.transformSchedulerData(id, rawJobData ? array2obj(rawJobData) : null, next ? parseInt(next) : null);
    }
    getTemplateFromJSON(rawData, rawOpts) {
        const template = {};
        if (rawData) {
            template.data = JSON.parse(rawData);
        }
        if (rawOpts) {
            template.opts = Job.optsFromJSON(rawOpts);
        }
        return template;
    }
    async getJobSchedulers(start = 0, end = -1, asc = false) {
        const client = await this.client;
        const jobSchedulersKey = this.keys.repeat;
        const result = asc
            ? await client.zrange(jobSchedulersKey, start, end, { WITHSCORES: true })
            : await client.zrevrange(jobSchedulersKey, start, end, {
                WITHSCORES: true,
            });
        const jobs = [];
        for (let i = 0; i < result.length; i += 2) {
            jobs.push(this.getSchedulerData(client, result[i], parseInt(result[i + 1])));
        }
        return Promise.all(jobs);
    }
    async getSchedulersCount() {
        const jobSchedulersKey = this.keys.repeat;
        const client = await this.client;
        return client.zcard(jobSchedulersKey);
    }
    getSchedulerNextJobId({ nextMillis, jobSchedulerId, }) {
        return `repeat:${jobSchedulerId}:${nextMillis}`;
    }
}
export const defaultRepeatStrategy = (millis, opts) => {
    const { pattern } = opts;
    const dateFromMillis = new Date(millis);
    const startDate = opts.startDate && new Date(opts.startDate);
    const currentDate = startDate > dateFromMillis ? startDate : dateFromMillis;
    const interval = parseExpression(pattern, Object.assign(Object.assign({}, opts), { currentDate }));
    try {
        if (opts.immediately) {
            return new Date().getTime();
        }
        else {
            return interval.next().getTime();
        }
    }
    catch (e) {
        // Ignore error
    }
};
