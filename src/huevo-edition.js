import {HUEVO_RTP} from './runtime-rtp-range.js';
export const HUEVO_EDITION=import.meta.env?.VITE_MASQ_EDITION==='huevo'
  || (typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('edition')==='huevo');
export const HUEVO_SLOT_PROFILES=Object.freeze({slots:HUEVO_RTP,maskhouse:HUEVO_RTP,lecipher:HUEVO_RTP});
export const HUEVO_CLASSIC_PROFILES=Object.freeze({coinflip:HUEVO_RTP,dice:HUEVO_RTP,plinko:HUEVO_RTP,roulette:HUEVO_RTP,upgrader:HUEVO_RTP,blackjack:HUEVO_RTP});
