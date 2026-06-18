export var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["JobNotExist"] = -1] = "JobNotExist";
    ErrorCode[ErrorCode["JobLockNotExist"] = -2] = "JobLockNotExist";
    ErrorCode[ErrorCode["JobNotInState"] = -3] = "JobNotInState";
    ErrorCode[ErrorCode["JobPendingChildren"] = -4] = "JobPendingChildren";
    ErrorCode[ErrorCode["ParentJobNotExist"] = -5] = "ParentJobNotExist";
    ErrorCode[ErrorCode["JobLockMismatch"] = -6] = "JobLockMismatch";
    ErrorCode[ErrorCode["ParentJobCannotBeReplaced"] = -7] = "ParentJobCannotBeReplaced";
    ErrorCode[ErrorCode["JobBelongsToJobScheduler"] = -8] = "JobBelongsToJobScheduler";
    ErrorCode[ErrorCode["JobHasFailedChildren"] = -9] = "JobHasFailedChildren";
    ErrorCode[ErrorCode["SchedulerJobIdCollision"] = -10] = "SchedulerJobIdCollision";
    ErrorCode[ErrorCode["SchedulerJobSlotsBusy"] = -11] = "SchedulerJobSlotsBusy";
})(ErrorCode || (ErrorCode = {}));
