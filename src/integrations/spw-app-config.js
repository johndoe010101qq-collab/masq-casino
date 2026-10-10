// Public registration identifiers. Application/card tokens never belong here.
export const SPW_APP_ID = (import.meta.env.VITE_SPW_APP_ID || '').trim();
export const SPW_APP_URL = SPW_APP_ID
  ? `https://spworlds.ru/spm/apps/${encodeURIComponent(SPW_APP_ID)}`
  : 'https://spworlds.ru/';
export const SERVER_ADMIN_ENABLED = import.meta.env.VITE_MASQ_SERVER_ADMIN === '1';
