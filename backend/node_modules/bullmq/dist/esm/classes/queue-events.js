import { __rest } from "tslib";
import { array2obj, clientCommandMessageReg, isRedisInstance, QUEUE_EVENT_SUFFIX, } from '../utils';
import { QueueBase } from './queue-base';
import { createIORedisClient, isIRedisClient } from './ioredis-client';
/**
 * The QueueEvents class is used for listening to the global events
 * emitted by a given queue.
 *
 * This class requires a dedicated redis connection.
 *
 */
export class QueueEvents extends QueueBase {
    constructor(name, _a = {
        connection: {},
    }, Connection) {
        var { connection, autorun = true } = _a, opts = __rest(_a, ["connection", "autorun"]);
        super(name, Object.assign(Object.assign({}, opts), { connection: isRedisInstance(connection)
                ? (isIRedisClient(connection)
                    ? connection
                    : createIORedisClient(connection)).duplicate()
                : connection }), Connection, true);
        this.running = false;
        this.blocking = false;
        this.opts = Object.assign({
            blockingTimeout: 10000,
        }, this.opts);
        if (autorun) {
            this.run().catch(error => this.emit('error', error));
        }
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    off(eventName, listener) {
        super.off(eventName, listener);
        return this;
    }
    on(event, listener) {
        super.on(event, listener);
        return this;
    }
    once(event, listener) {
        super.once(event, listener);
        return this;
    }
    /**
     * Manually starts running the event consumming loop. This shall be used if you do not
     * use the default "autorun" option on the constructor.
     */
    async run() {
        if (!this.running) {
            try {
                this.running = true;
                const client = await this.client;
                // TODO: Planned for deprecation as it really has no use case
                try {
                    await client.clientSetName(this.clientName(QUEUE_EVENT_SUFFIX));
                }
                catch (err) {
                    if (!clientCommandMessageReg.test(err.message) &&
                        !this.closing) {
                        throw err;
                    }
                }
                await this.consumeEvents(client);
            }
            catch (error) {
                this.running = false;
                throw error;
            }
        }
        else {
            throw new Error('Queue Events is already running.');
        }
    }
    async consumeEvents(client) {
        const opts = this.opts;
        const key = this.keys.events;
        let id = opts.lastEventId || '$';
        while (!this.closing) {
            this.blocking = true;
            // Cast to actual return type, see: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/44301
            const data = await this.checkConnectionError(() => client.xread([{ key, id }], { BLOCK: opts.blockingTimeout }));
            this.blocking = false;
            if (data) {
                const stream = data[0];
                const events = stream[1];
                for (let i = 0; i < events.length; i++) {
                    id = events[i][0];
                    const args = array2obj(events[i][1]);
                    //
                    // TODO: we may need to have a separate stream for progress data
                    // to avoid this hack.
                    switch (args.event) {
                        case 'progress':
                            args.data = JSON.parse(args.data);
                            break;
                        case 'completed':
                            args.returnvalue = JSON.parse(args.returnvalue);
                            break;
                    }
                    const { event } = args, restArgs = __rest(args, ["event"]);
                    if (event === 'drained') {
                        this.emit(event, id);
                    }
                    else {
                        this.emit(event, restArgs, id);
                        if (restArgs.jobId) {
                            this.emit(`${event}:${restArgs.jobId}`, restArgs, id);
                        }
                    }
                }
            }
        }
    }
    /**
     * Stops consuming events and close the underlying Redis connection if necessary.
     *
     * @returns
     */
    async close() {
        if (!this.closing) {
            this.closing = (async () => {
                try {
                    // As the connection has been wrongly marked as "shared" by QueueBase,
                    // we need to forcibly close it here. We should fix QueueBase to avoid this in the future.
                    const client = await this.client;
                    client.disconnect();
                    await this.connection.close(this.blocking);
                }
                finally {
                    this.closed = true;
                }
            })();
        }
        return this.closing;
    }
}
