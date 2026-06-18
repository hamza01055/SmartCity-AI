import { QueueEventsProducerOptions } from '../interfaces';
import { QueueBase } from './queue-base';
import { RedisConnection } from './redis-connection';
/**
 * The QueueEventsProducer class is used for publishing custom events.
 */
export declare class QueueEventsProducer extends QueueBase {
    constructor(name: string, opts?: QueueEventsProducerOptions, Connection?: typeof RedisConnection);
    /**
     * Publish custom event to be processed in QueueEvents.
     * @param argsObj - Event payload
     * @param maxEvents - Max quantity of events to be saved
     */
    publishEvent<T extends {
        eventName: string;
    }>(argsObj: T, maxEvents?: number): Promise<void>;
    /**
     * Closes the connection and returns a promise that resolves when the connection is closed.
     */
    close(): Promise<void>;
}
