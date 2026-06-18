"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScripts = void 0;
const scripts_1 = require("../classes/scripts");
/*
 * Factory method to create a Scripts object.
 */
const createScripts = (queue) => {
    return new scripts_1.Scripts({
        keys: queue.keys,
        client: queue.client,
        get redisVersion() {
            return queue.redisVersion;
        },
        toKey: queue.toKey,
        opts: queue.opts,
        closing: queue.closing,
        databaseType: queue.databaseType,
    });
};
exports.createScripts = createScripts;
