import { BackoffOptions } from '../interfaces/backoff-options';
import { MinimalJob } from '../interfaces/minimal-job';
import { BackoffStrategy } from '../types/backoff-strategy';
export interface BuiltInStrategies {
    [index: string]: (delay: number, jitter?: number) => BackoffStrategy;
}
export declare class Backoffs {
    static builtinStrategies: BuiltInStrategies;
    static normalize(backoff: number | BackoffOptions): BackoffOptions | undefined;
    static calculate(backoff: BackoffOptions, attemptsMade: number, err: Error, job: MinimalJob, customStrategy?: BackoffStrategy): Promise<number> | number | undefined;
}
