"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Backoffs = void 0;
class Backoffs {
    static normalize(backoff) {
        if (Number.isFinite(backoff)) {
            return {
                type: 'fixed',
                delay: backoff,
            };
        }
        else if (backoff) {
            return backoff;
        }
    }
    static calculate(backoff, attemptsMade, err, job, customStrategy) {
        if (backoff) {
            const strategy = lookupStrategy(backoff, customStrategy);
            return strategy(attemptsMade, backoff.type, err, job);
        }
    }
}
exports.Backoffs = Backoffs;
Backoffs.builtinStrategies = {
    fixed: function (delay, jitter = 0) {
        return function () {
            if (jitter > 0) {
                const minDelay = delay * (1 - jitter);
                return Math.floor(Math.random() * delay * jitter + minDelay);
            }
            else {
                return delay;
            }
        };
    },
    exponential: function (delay, jitter = 0) {
        return function (attemptsMade) {
            if (jitter > 0) {
                const maxDelay = Math.round(Math.pow(2, attemptsMade - 1) * delay);
                const minDelay = maxDelay * (1 - jitter);
                return Math.floor(Math.random() * maxDelay * jitter + minDelay);
            }
            else {
                return Math.round(Math.pow(2, attemptsMade - 1) * delay);
            }
        };
    },
};
function lookupStrategy(backoff, customStrategy) {
    if (backoff.type in Backoffs.builtinStrategies) {
        return Backoffs.builtinStrategies[backoff.type](backoff.delay, backoff.jitter);
    }
    else if (customStrategy) {
        return customStrategy;
    }
    else {
        throw new Error(`Unknown backoff strategy ${backoff.type}.
      If a custom backoff strategy is used, specify it when the queue is created.`);
    }
}
