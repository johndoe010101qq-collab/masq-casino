import {isDemoRtp} from './rtp-range.js';
export const HUEVO_RTP=97;
export const isRuntimeRtp=value=>isDemoRtp(value)||value===HUEVO_RTP;
