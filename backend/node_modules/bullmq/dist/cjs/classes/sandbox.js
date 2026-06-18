"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const enums_1 = require("../enums");
const sandbox = (processFile, childPool) => {
    return async function process(job, token, signal) {
        let child;
        let msgHandler;
        let exitHandler;
        let abortHandler;
        try {
            const done = new Promise((resolve, reject) => {
                const initChild = async () => {
                    try {
                        exitHandler = (exitCode, signal) => {
                            reject(new Error('Unexpected exit code: ' + exitCode + ' signal: ' + signal));
                        };
                        child = await childPool.retain(processFile);
                        child.on('exit', exitHandler);
                        msgHandler = async (msg) => {
                            var _a, _b, _c, _d, _e;
                            try {
                                switch (msg.cmd) {
                                    case enums_1.ParentCommand.Completed:
                                        resolve(msg.value);
                                        break;
                                    case enums_1.ParentCommand.Failed:
                                    case enums_1.ParentCommand.Error: {
                                        const err = new Error();
                                        Object.assign(err, msg.value);
                                        reject(err);
                                        break;
                                    }
                                    case enums_1.ParentCommand.Progress:
                                        await job.updateProgress(msg.value);
                                        break;
                                    case enums_1.ParentCommand.Log:
                                        await job.log(msg.value);
                                        break;
                                    case enums_1.ParentCommand.MoveToDelayed:
                                        await job.moveToDelayed((_a = msg.value) === null || _a === void 0 ? void 0 : _a.timestamp, (_b = msg.value) === null || _b === void 0 ? void 0 : _b.token);
                                        break;
                                    case enums_1.ParentCommand.MoveToWait:
                                        await job.moveToWait((_c = msg.value) === null || _c === void 0 ? void 0 : _c.token);
                                        break;
                                    case enums_1.ParentCommand.MoveToWaitingChildren:
                                        {
                                            const value = await job.moveToWaitingChildren((_d = msg.value) === null || _d === void 0 ? void 0 : _d.token, (_e = msg.value) === null || _e === void 0 ? void 0 : _e.opts);
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: enums_1.ChildCommand.MoveToWaitingChildrenResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case enums_1.ParentCommand.Update:
                                        await job.updateData(msg.value);
                                        break;
                                    case enums_1.ParentCommand.GetChildrenValues:
                                        {
                                            const value = await job.getChildrenValues();
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: enums_1.ChildCommand.GetChildrenValuesResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case enums_1.ParentCommand.GetIgnoredChildrenFailures:
                                        {
                                            const value = await job.getIgnoredChildrenFailures();
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: enums_1.ChildCommand.GetIgnoredChildrenFailuresResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case enums_1.ParentCommand.GetDependenciesCount:
                                        {
                                            const value = await job.getDependenciesCount(msg.value);
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: enums_1.ChildCommand.GetDependenciesCountResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case enums_1.ParentCommand.GetDependencies:
                                        {
                                            const value = await job.getDependencies(msg.value);
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: enums_1.ChildCommand.GetDependenciesResponse,
                                                value,
                                            });
                                        }
                                        break;
                                }
                            }
                            catch (err) {
                                reject(err);
                            }
                        };
                        child.on('message', msgHandler);
                        child.send({
                            cmd: enums_1.ChildCommand.Start,
                            job: job.asJSONSandbox(),
                            token,
                        });
                        if (signal) {
                            abortHandler = () => {
                                try {
                                    child.send({
                                        cmd: enums_1.ChildCommand.Cancel,
                                        value: signal.reason,
                                    });
                                }
                                catch (_a) {
                                    // Child process may have already exited
                                }
                            };
                            if (signal.aborted) {
                                abortHandler();
                            }
                            else {
                                signal.addEventListener('abort', abortHandler, { once: true });
                            }
                        }
                    }
                    catch (error) {
                        reject(error);
                    }
                };
                initChild();
            });
            await done;
            return done;
        }
        finally {
            // Note: There is a potential race where the signal is aborted between
            // `await done` and this cleanup. This is safe because:
            // 1. abortHandler has a try-catch for child process already exited
            // 2. The listener is added with `once: true`, so it fires at most once
            // 3. removeEventListener here is defensive cleanup only
            if (signal && abortHandler) {
                signal.removeEventListener('abort', abortHandler);
            }
            if (child) {
                child.off('message', msgHandler);
                child.off('exit', exitHandler);
                if (child.exitCode === null && child.signalCode === null) {
                    childPool.release(child);
                }
            }
        }
    };
};
exports.default = sandbox;
