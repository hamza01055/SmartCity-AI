import { AbortController } from './abort-controller';
import { SpanKind, TelemetryAttributes } from '../enums';
/**
 * Manages lock renewal for BullMQ workers.
 * It periodically extends locks for active jobs to prevent them from being
 * considered stalled by other workers.
 */
export class LockManager {
    constructor(worker, opts) {
        this.worker = worker;
        this.opts = opts;
        // Maps job ids with their tokens, timestamps, and abort controllers
        this.trackedJobs = new Map();
        this.closed = false;
    }
    /**
     * Starts the lock manager timers for lock renewal.
     */
    start() {
        if (this.closed) {
            return;
        }
        // Start lock renewal timer if not disabled
        if (this.opts.lockRenewTime > 0) {
            this.startLockExtenderTimer();
        }
    }
    async extendLocks(jobIds) {
        await this.worker.trace(SpanKind.INTERNAL, 'extendLocks', this.worker.name, async (span) => {
            span === null || span === void 0 ? void 0 : span.setAttributes({
                [TelemetryAttributes.WorkerId]: this.opts.workerId,
                [TelemetryAttributes.WorkerName]: this.opts.workerName,
                [TelemetryAttributes.WorkerJobsToExtendLocks]: jobIds,
            });
            try {
                const jobTokens = jobIds.map(id => { var _a; return ((_a = this.trackedJobs.get(id)) === null || _a === void 0 ? void 0 : _a.token) || ''; });
                const erroredJobIds = await this.worker.extendJobLocks(jobIds, jobTokens, this.opts.lockDuration);
                if (erroredJobIds.length > 0) {
                    this.worker.emit('lockRenewalFailed', erroredJobIds);
                    for (const jobId of erroredJobIds) {
                        this.worker.emit('error', new Error(`could not renew lock for job ${jobId}`));
                    }
                }
                const succeededJobIds = jobIds.filter(id => !erroredJobIds.includes(id));
                if (succeededJobIds.length > 0) {
                    this.worker.emit('locksRenewed', {
                        count: succeededJobIds.length,
                        jobIds: succeededJobIds,
                    });
                }
            }
            catch (err) {
                this.worker.emit('error', err);
            }
        });
    }
    startLockExtenderTimer() {
        clearTimeout(this.lockRenewalTimer);
        if (!this.closed) {
            this.lockRenewalTimer = setTimeout(async () => {
                // Get all the jobs whose locks expire in less than 1/2 of the lockRenewTime
                const now = Date.now();
                const jobsToExtend = [];
                for (const jobId of this.trackedJobs.keys()) {
                    const tracked = this.trackedJobs.get(jobId);
                    const { ts, token, abortController } = tracked;
                    if (!ts) {
                        this.trackedJobs.set(jobId, { token, ts: now, abortController });
                        continue;
                    }
                    if (ts + this.opts.lockRenewTime / 2 < now) {
                        this.trackedJobs.set(jobId, { token, ts: now, abortController });
                        jobsToExtend.push(jobId);
                    }
                }
                if (jobsToExtend.length) {
                    await this.extendLocks(jobsToExtend);
                }
                this.startLockExtenderTimer();
            }, this.opts.lockRenewTime / 2);
        }
    }
    /**
     * Stops the lock manager and clears all timers.
     */
    async close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this.lockRenewalTimer) {
            clearTimeout(this.lockRenewalTimer);
            this.lockRenewalTimer = undefined;
        }
        this.trackedJobs.clear();
    }
    /**
     * Adds a job to be tracked for lock renewal.
     * Returns an AbortController if shouldCreateController is true, undefined otherwise.
     */
    trackJob(jobId, token, ts, shouldCreateController = false) {
        const abortController = shouldCreateController
            ? new AbortController()
            : undefined;
        if (!this.closed && jobId) {
            this.trackedJobs.set(jobId, { token, ts, abortController });
        }
        return abortController;
    }
    /**
     * Removes a job from lock renewal tracking.
     */
    untrackJob(jobId) {
        this.trackedJobs.delete(jobId);
    }
    /**
     * Gets the number of jobs currently being tracked.
     */
    getActiveJobCount() {
        return this.trackedJobs.size;
    }
    /**
     * Checks if the lock manager is running.
     */
    isRunning() {
        return !this.closed && this.lockRenewalTimer !== undefined;
    }
    /**
     * Cancels a specific job by aborting its signal.
     * @param jobId - The ID of the job to cancel
     * @param reason - Optional reason for the cancellation
     * @returns true if the job was found and cancelled, false otherwise
     */
    cancelJob(jobId, reason) {
        const tracked = this.trackedJobs.get(jobId);
        if (tracked === null || tracked === void 0 ? void 0 : tracked.abortController) {
            tracked.abortController.abort(reason);
            return true;
        }
        return false;
    }
    /**
     * Cancels all tracked jobs by aborting their signals.
     * @param reason - Optional reason for the cancellation
     */
    cancelAllJobs(reason) {
        for (const tracked of this.trackedJobs.values()) {
            if (tracked.abortController) {
                tracked.abortController.abort(reason);
            }
        }
    }
    /**
     * Gets a list of all tracked job IDs.
     * @returns Array of job IDs currently being tracked
     */
    getTrackedJobIds() {
        return Array.from(this.trackedJobs.keys());
    }
}
