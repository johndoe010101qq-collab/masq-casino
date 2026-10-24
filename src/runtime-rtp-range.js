import {isDemoRtp} from './rtp-range.js';
export const HUEVO_RTP=92;
// 97 remains readable for historical receipts; new huEVO sessions pin 92.
export const isRuntimeRtp=value=>isDemoRtp(value)||value===97;
