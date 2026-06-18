"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbortController = void 0;
// Note: this Polyfill is only needed for Node versions < 15.4.0
const node_abort_controller_1 = require("node-abort-controller");
let AbortControllerImpl;
// prefer native AbortController implementation if found
if (globalThis.AbortController) {
    AbortControllerImpl =
        globalThis.AbortController;
}
else {
    AbortControllerImpl = node_abort_controller_1.AbortController;
}
class AbortController extends AbortControllerImpl {
}
exports.AbortController = AbortController;
