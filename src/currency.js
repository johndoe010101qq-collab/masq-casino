import {HUEVO_EDITION} from './huevo-edition.js';

export const CURRENCY=HUEVO_EDITION?'монэтки':'АР';
// UI text only. Integer accounting units and the game engines stay unchanged.
export const currencyText=value=>HUEVO_EDITION?String(value).replace(/(?<![А-Яа-яЁёA-Za-z])АР(?![А-Яа-яЁёA-Za-z])/g,'монэтки'):value;
