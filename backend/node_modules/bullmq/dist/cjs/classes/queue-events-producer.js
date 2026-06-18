"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueEventsProducer = void 0;
const tslib_1 = require("tslib");
const queue_base_1 = require("./queue-base");
/**
 * The QueueEventsProducer class is used for publishing custom events.
 */
class QueueEventsProducer extends queue_base_1.QueueBase {
    constructor(name, opts = {
        connection: {},
    }, Connection) {
        super(name, Object.assign({ blockingConnection: false }, opts), Connection);
        this.opts = opts;
    }
    /**
     * Publish custom event to be processed in QueueEvents.
     * @param argsObj - Event payload
     * @param maxEvents - Max quantity of events to be saved
     */
    async publishEvent(argsObj, maxEvents = 1000) {
        const client = await this.client;
        const key = this.keys.events;
        const { eventName } = argsObj, restArgs = tslib_1.__rest(argsObj, ["eventName"]);
        const fields = Object.assign({ event: eventName }, restArgs);
        await client.xadd(key, '*', fields, {
            MAXLEN: maxEvents,
            approximate: true,
        });
    }
    /**
     * Closes the connection and returns a promise that resolves when the connection is closed.
     */
    async close() {
        if (!this.closing) {
            this.closing = this.connection.close();
        }
        await this.closing;
    }
}
exports.QueueEventsProducer = QueueEventsProducer;
