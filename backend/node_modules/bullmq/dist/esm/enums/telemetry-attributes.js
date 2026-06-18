export var TelemetryAttributes;
(function (TelemetryAttributes) {
    TelemetryAttributes["QueueName"] = "bullmq.queue.name";
    TelemetryAttributes["QueueOperation"] = "bullmq.queue.operation";
    TelemetryAttributes["BulkCount"] = "bullmq.job.bulk.count";
    TelemetryAttributes["BulkNames"] = "bullmq.job.bulk.names";
    TelemetryAttributes["JobName"] = "bullmq.job.name";
    TelemetryAttributes["JobId"] = "bullmq.job.id";
    TelemetryAttributes["JobKey"] = "bullmq.job.key";
    TelemetryAttributes["JobIds"] = "bullmq.job.ids";
    TelemetryAttributes["JobAttemptsMade"] = "bullmq.job.attempts.made";
    TelemetryAttributes["DeduplicationKey"] = "bullmq.job.deduplication.key";
    TelemetryAttributes["JobOptions"] = "bullmq.job.options";
    TelemetryAttributes["JobProgress"] = "bullmq.job.progress";
    TelemetryAttributes["QueueDrainDelay"] = "bullmq.queue.drain.delay";
    TelemetryAttributes["QueueGrace"] = "bullmq.queue.grace";
    TelemetryAttributes["QueueCleanLimit"] = "bullmq.queue.clean.limit";
    TelemetryAttributes["QueueRateLimit"] = "bullmq.queue.rate.limit";
    TelemetryAttributes["JobType"] = "bullmq.job.type";
    TelemetryAttributes["QueueOptions"] = "bullmq.queue.options";
    TelemetryAttributes["QueueEventMaxLength"] = "bullmq.queue.event.max.length";
    TelemetryAttributes["QueueJobsState"] = "bullmq.queue.jobs.state";
    TelemetryAttributes["WorkerOptions"] = "bullmq.worker.options";
    TelemetryAttributes["WorkerName"] = "bullmq.worker.name";
    TelemetryAttributes["WorkerId"] = "bullmq.worker.id";
    TelemetryAttributes["WorkerRateLimit"] = "bullmq.worker.rate.limit";
    TelemetryAttributes["WorkerDoNotWaitActive"] = "bullmq.worker.do.not.wait.active";
    TelemetryAttributes["WorkerForceClose"] = "bullmq.worker.force.close";
    TelemetryAttributes["WorkerStalledJobs"] = "bullmq.worker.stalled.jobs";
    TelemetryAttributes["WorkerFailedJobs"] = "bullmq.worker.failed.jobs";
    TelemetryAttributes["WorkerJobsToExtendLocks"] = "bullmq.worker.jobs.to.extend.locks";
    /**
     * @deprecated Use JobAttemptFinishedTimestamp instead. Will be removed in a future version.
     */
    TelemetryAttributes["JobFinishedTimestamp"] = "bullmq.job.finished.timestamp";
    TelemetryAttributes["JobAttemptFinishedTimestamp"] = "bullmq.job.attempt_finished_timestamp";
    TelemetryAttributes["JobProcessedTimestamp"] = "bullmq.job.processed.timestamp";
    TelemetryAttributes["JobResult"] = "bullmq.job.result";
    TelemetryAttributes["JobFailedReason"] = "bullmq.job.failed.reason";
    TelemetryAttributes["FlowName"] = "bullmq.flow.name";
    TelemetryAttributes["JobSchedulerId"] = "bullmq.job.scheduler.id";
    TelemetryAttributes["JobStatus"] = "bullmq.job.status";
})(TelemetryAttributes || (TelemetryAttributes = {}));
/**
 * Standard metric names for BullMQ telemetry
 */
export var MetricNames;
(function (MetricNames) {
    MetricNames["QueueJobsCount"] = "bullmq.queue.jobs";
    MetricNames["JobsCompleted"] = "bullmq.jobs.completed";
    MetricNames["JobsFailed"] = "bullmq.jobs.failed";
    MetricNames["JobsDelayed"] = "bullmq.jobs.delayed";
    MetricNames["JobsRetried"] = "bullmq.jobs.retried";
    MetricNames["JobsWaiting"] = "bullmq.jobs.waiting";
    MetricNames["JobsWaitingChildren"] = "bullmq.jobs.waiting_children";
    MetricNames["JobDuration"] = "bullmq.job.duration";
})(MetricNames || (MetricNames = {}));
export var SpanKind;
(function (SpanKind) {
    SpanKind[SpanKind["INTERNAL"] = 0] = "INTERNAL";
    SpanKind[SpanKind["SERVER"] = 1] = "SERVER";
    SpanKind[SpanKind["CLIENT"] = 2] = "CLIENT";
    SpanKind[SpanKind["PRODUCER"] = 3] = "PRODUCER";
    SpanKind[SpanKind["CONSUMER"] = 4] = "CONSUMER";
})(SpanKind || (SpanKind = {}));
