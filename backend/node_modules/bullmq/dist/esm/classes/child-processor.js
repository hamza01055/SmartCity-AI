import { AbortController } from './abort-controller';
import { ParentCommand } from '../enums';
import { errorToJSON } from '../utils';
var ChildStatus;
(function (ChildStatus) {
    ChildStatus[ChildStatus["Idle"] = 0] = "Idle";
    ChildStatus[ChildStatus["Started"] = 1] = "Started";
    ChildStatus[ChildStatus["Terminating"] = 2] = "Terminating";
    ChildStatus[ChildStatus["Errored"] = 3] = "Errored";
})(ChildStatus || (ChildStatus = {}));
const RESPONSE_TIMEOUT = process.env.NODE_ENV === 'test' ? 500 : 5000;
/**
 * ChildProcessor
 *
 * This class acts as the interface between a child process and it parent process
 * so that jobs can be processed in different processes.
 *
 */
export class ChildProcessor {
    constructor(send, receiver) {
        this.send = send;
        this.receiver = receiver;
    }
    async init(processorFile) {
        let processor;
        try {
            const { default: processorFn } = await import(processorFile);
            processor = processorFn;
            if (processor.default) {
                // support es2015 module.
                processor = processor.default;
            }
            if (typeof processor !== 'function') {
                throw new Error('No function is exported in processor file');
            }
        }
        catch (err) {
            this.status = ChildStatus.Errored;
            return this.send({
                cmd: ParentCommand.InitFailed,
                err: errorToJSON(err),
            });
        }
        const origProcessor = processor;
        processor = function (job, token, signal) {
            try {
                return Promise.resolve(origProcessor(job, token, signal));
            }
            catch (err) {
                return Promise.reject(err);
            }
        };
        this.processor = processor;
        this.status = ChildStatus.Idle;
        await this.send({
            cmd: ParentCommand.InitCompleted,
        });
    }
    async start(jobJson, token) {
        if (this.status !== ChildStatus.Idle) {
            return this.send({
                cmd: ParentCommand.Error,
                err: errorToJSON(new Error('cannot start a not idling child process')),
            });
        }
        this.status = ChildStatus.Started;
        this.abortController = new AbortController();
        this.currentJobPromise = (async () => {
            try {
                const job = this.wrapJob(jobJson, this.send);
                const result = await this.processor(job, token, this.abortController.signal);
                await this.send({
                    cmd: ParentCommand.Completed,
                    value: typeof result === 'undefined' ? null : result,
                });
            }
            catch (err) {
                await this.send({
                    cmd: ParentCommand.Failed,
                    value: errorToJSON(!err.message ? new Error(err) : err),
                });
            }
            finally {
                this.status = ChildStatus.Idle;
                this.currentJobPromise = undefined;
                this.abortController = undefined;
            }
        })();
    }
    /**
     * Cancels the currently running job by aborting its signal.
     * @param reason - Optional reason for the cancellation
     */
    cancel(reason) {
        if (this.abortController) {
            this.abortController.abort(reason);
        }
    }
    async stop() { }
    async waitForCurrentJobAndExit() {
        this.status = ChildStatus.Terminating;
        try {
            await this.currentJobPromise;
        }
        finally {
            process.exit(process.exitCode || 0);
        }
    }
    /**
     * Enhance the given job argument with some functions
     * that can be called from the sandboxed job processor.
     *
     * Note, the `job` argument is a JSON deserialized message
     * from the main node process to this forked child process,
     * the functions on the original job object are not in tact.
     * The wrapped job adds back some of those original functions.
     */
    wrapJob(job, send) {
        const wrappedJob = Object.assign(Object.assign({}, job), { queueQualifiedName: job.queueQualifiedName, data: JSON.parse(job.data || '{}'), opts: job.opts, returnValue: JSON.parse(job.returnvalue || '{}'), 
            /*
             * Proxy `updateProgress` function, should works as `progress` function.
             */
            async updateProgress(progress) {
                // Locally store reference to new progress value
                // so that we can return it from this process synchronously.
                this.progress = progress;
                // Send message to update job progress.
                await send({
                    cmd: ParentCommand.Progress,
                    value: progress,
                });
            }, 
            /*
             * Proxy job `log` function.
             */
            log: async (row) => {
                await send({
                    cmd: ParentCommand.Log,
                    value: row,
                });
            }, 
            /*
             * Proxy `moveToDelayed` function.
             */
            moveToDelayed: async (timestamp, token) => {
                await send({
                    cmd: ParentCommand.MoveToDelayed,
                    value: { timestamp, token },
                });
            }, 
            /*
             * Proxy `moveToWait` function.
             */
            moveToWait: async (token) => {
                await send({
                    cmd: ParentCommand.MoveToWait,
                    value: { token },
                });
            }, 
            /*
             * Proxy `moveToWaitingChildren` function.
             */
            moveToWaitingChildren: async (token, opts) => {
                const requestId = Math.random().toString(36).substring(2, 15);
                await send({
                    requestId,
                    cmd: ParentCommand.MoveToWaitingChildren,
                    value: { token, opts },
                });
                return waitResponse(requestId, this.receiver, RESPONSE_TIMEOUT, 'moveToWaitingChildren');
            }, 
            /*
             * Proxy `updateData` function.
             */
            updateData: async (data) => {
                await send({
                    cmd: ParentCommand.Update,
                    value: data,
                });
                wrappedJob.data = data;
            }, 
            /**
             * Proxy `getChildrenValues` function.
             */
            getChildrenValues: async () => {
                const requestId = Math.random().toString(36).substring(2, 15);
                await send({
                    requestId,
                    cmd: ParentCommand.GetChildrenValues,
                });
                return waitResponse(requestId, this.receiver, RESPONSE_TIMEOUT, 'getChildrenValues');
            }, 
            /**
             * Proxy `getIgnoredChildrenFailures` function.
             *
             * This method sends a request to retrieve the failures of ignored children
             * and waits for a response from the parent process.
             *
             * @returns - A promise that resolves with the ignored children failures.
             * The exact structure of the returned data depends on the parent process implementation.
             */
            getIgnoredChildrenFailures: async () => {
                const requestId = Math.random().toString(36).substring(2, 15);
                await send({
                    requestId,
                    cmd: ParentCommand.GetIgnoredChildrenFailures,
                });
                return waitResponse(requestId, this.receiver, RESPONSE_TIMEOUT, 'getIgnoredChildrenFailures');
            }, 
            /**
             * Proxy `getDependenciesCount` function.
             */
            getDependenciesCount: async (opts) => {
                const requestId = Math.random().toString(36).substring(2, 15);
                await send({
                    requestId,
                    cmd: ParentCommand.GetDependenciesCount,
                    value: opts,
                });
                return waitResponse(requestId, this.receiver, RESPONSE_TIMEOUT, 'getDependenciesCount');
            }, 
            /**
             * Proxy `getDependencies` function.
             */
            getDependencies: async (opts) => {
                const requestId = Math.random().toString(36).substring(2, 15);
                await send({
                    requestId,
                    cmd: ParentCommand.GetDependencies,
                    value: opts,
                });
                return waitResponse(requestId, this.receiver, RESPONSE_TIMEOUT, 'getDependencies');
            } });
        return wrappedJob;
    }
}
const waitResponse = async (requestId, receiver, timeout, cmd) => {
    return new Promise((resolve, reject) => {
        const listener = (msg) => {
            if (msg.requestId === requestId) {
                resolve(msg.value);
                receiver.off('message', listener);
            }
        };
        receiver.on('message', listener);
        setTimeout(() => {
            receiver.off('message', listener);
            reject(new Error(`TimeoutError: ${cmd} timed out in (${timeout}ms)`));
        }, timeout);
    });
};
