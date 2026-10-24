export const HUEVO_EDITION=import.meta.env?.VITE_MASQ_EDITION==='huevo'
  || (typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('edition')==='huevo');
export const HUEVO_SLOT_PROFILES=Object.freeze({slots:97,maskhouse:97,lecipher:97});
export const HUEVO_CLASSIC_PROFILES=Object.freeze({coinflip:97,dice:97,plinko:97,roulette:97,upgrader:97,blackjack:97});
