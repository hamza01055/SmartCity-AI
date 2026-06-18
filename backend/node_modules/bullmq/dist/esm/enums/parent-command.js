export var ParentCommand;
(function (ParentCommand) {
    ParentCommand[ParentCommand["Completed"] = 0] = "Completed";
    ParentCommand[ParentCommand["Error"] = 1] = "Error";
    ParentCommand[ParentCommand["Failed"] = 2] = "Failed";
    ParentCommand[ParentCommand["InitFailed"] = 3] = "InitFailed";
    ParentCommand[ParentCommand["InitCompleted"] = 4] = "InitCompleted";
    ParentCommand[ParentCommand["Log"] = 5] = "Log";
    ParentCommand[ParentCommand["MoveToDelayed"] = 6] = "MoveToDelayed";
    ParentCommand[ParentCommand["MoveToWait"] = 7] = "MoveToWait";
    ParentCommand[ParentCommand["Progress"] = 8] = "Progress";
    ParentCommand[ParentCommand["Update"] = 9] = "Update";
    ParentCommand[ParentCommand["GetChildrenValues"] = 10] = "GetChildrenValues";
    ParentCommand[ParentCommand["GetIgnoredChildrenFailures"] = 11] = "GetIgnoredChildrenFailures";
    ParentCommand[ParentCommand["GetDependenciesCount"] = 12] = "GetDependenciesCount";
    ParentCommand[ParentCommand["MoveToWaitingChildren"] = 13] = "MoveToWaitingChildren";
    ParentCommand[ParentCommand["GetDependencies"] = 14] = "GetDependencies";
})(ParentCommand || (ParentCommand = {}));
