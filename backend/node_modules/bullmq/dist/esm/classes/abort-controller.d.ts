import { AbortController as AbortControllerPolyfill } from 'node-abort-controller';
declare let AbortControllerImpl: typeof AbortControllerPolyfill;
export declare class AbortController extends AbortControllerImpl {
}
export {};
