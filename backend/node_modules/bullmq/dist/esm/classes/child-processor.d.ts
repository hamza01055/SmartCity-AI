import { Receiver, SandboxedJob } from '../interfaces';
import { JobJsonSandbox } from '../types';
declare enum ChildStatus {
    Idle = 0,
    Started = 1,
    Terminating = 2,
    Errored = 3
}
/**
 * ChildProcessor
 *
 * This class acts as the interface between a child process and it parent process
 * so that jobs can be processed in different processes.
 *
 */
export declare class ChildProcessor {
    private send;
    private receiver;
    status?: ChildStatus;
    processor: any;
    currentJobPromise: Promise<unknown> | undefined;
    private abortController?;
    constructor(send: (msg: any) => Promise<void>, receiver: Receiver);
    init(processorFile: string): Promise<void>;
    start(jobJson: JobJsonSandbox, token?: string): Promise<void>;
    /**
     * Cancels the currently running job by aborting its signal.
     * @param reason - Optional reason for the cancellation
     */
    cancel(reason?: string): void;
    stop(): Promise<void>;
    waitForCurrentJobAndExit(): Promise<void>;
    /**
     * Enhance the given job argument with some functions
     * that can be called from the sandboxed job processor.
     *
     * Note, the `job` argument is a JSON deserialized message
     * from the main node process to this forked child process,
     * the functions on the original job object are not in tact.
     * The wrapped job adds back some of those original functions.
     */
    protected wrapJob(job: JobJsonSandbox, send: (msg: any) => Promise<void>): SandboxedJob;
}
export {};
