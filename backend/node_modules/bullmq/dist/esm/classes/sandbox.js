import { ChildCommand, ParentCommand } from '../enums';
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
                                    case ParentCommand.Completed:
                                        resolve(msg.value);
                                        break;
                                    case ParentCommand.Failed:
                                    case ParentCommand.Error: {
                                        const err = new Error();
                                        Object.assign(err, msg.value);
                                        reject(err);
                                        break;
                                    }
                                    case ParentCommand.Progress:
                                        await job.updateProgress(msg.value);
                                        break;
                                    case ParentCommand.Log:
                                        await job.log(msg.value);
                                        break;
                                    case ParentCommand.MoveToDelayed:
                                        await job.moveToDelayed((_a = msg.value) === null || _a === void 0 ? void 0 : _a.timestamp, (_b = msg.value) === null || _b === void 0 ? void 0 : _b.token);
                                        break;
                                    case ParentCommand.MoveToWait:
                                        await job.moveToWait((_c = msg.value) === null || _c === void 0 ? void 0 : _c.token);
                                        break;
                                    case ParentCommand.MoveToWaitingChildren:
                                        {
                                            const value = await job.moveToWaitingChildren((_d = msg.value) === null || _d === void 0 ? void 0 : _d.token, (_e = msg.value) === null || _e === void 0 ? void 0 : _e.opts);
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: ChildCommand.MoveToWaitingChildrenResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case ParentCommand.Update:
                                        await job.updateData(msg.value);
                                        break;
                                    case ParentCommand.GetChildrenValues:
                                        {
                                            const value = await job.getChildrenValues();
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: ChildCommand.GetChildrenValuesResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case ParentCommand.GetIgnoredChildrenFailures:
                                        {
                                            const value = await job.getIgnoredChildrenFailures();
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: ChildCommand.GetIgnoredChildrenFailuresResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case ParentCommand.GetDependenciesCount:
                                        {
                                            const value = await job.getDependenciesCount(msg.value);
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: ChildCommand.GetDependenciesCountResponse,
                                                value,
                                            });
                                        }
                                        break;
                                    case ParentCommand.GetDependencies:
                                        {
                                            const value = await job.getDependencies(msg.value);
                                            child.send({
                                                requestId: msg.requestId,
                                                cmd: ChildCommand.GetDependenciesResponse,
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
                            cmd: ChildCommand.Start,
                            job: job.asJSONSandbox(),
                            token,
                        });
                        if (signal) {
                            abortHandler = () => {
                                try {
                                    child.send({
                                        cmd: ChildCommand.Cancel,
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
export default sandbox;
