"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChildCommand = void 0;
var ChildCommand;
(function (ChildCommand) {
    ChildCommand[ChildCommand["Init"] = 0] = "Init";
    ChildCommand[ChildCommand["Start"] = 1] = "Start";
    ChildCommand[ChildCommand["Stop"] = 2] = "Stop";
    ChildCommand[ChildCommand["GetChildrenValuesResponse"] = 3] = "GetChildrenValuesResponse";
    ChildCommand[ChildCommand["GetIgnoredChildrenFailuresResponse"] = 4] = "GetIgnoredChildrenFailuresResponse";
    ChildCommand[ChildCommand["GetDependenciesCountResponse"] = 5] = "GetDependenciesCountResponse";
    ChildCommand[ChildCommand["MoveToWaitingChildrenResponse"] = 6] = "MoveToWaitingChildrenResponse";
    ChildCommand[ChildCommand["Cancel"] = 7] = "Cancel";
    ChildCommand[ChildCommand["GetDependenciesResponse"] = 8] = "GetDependenciesResponse";
})(ChildCommand || (exports.ChildCommand = ChildCommand = {}));
