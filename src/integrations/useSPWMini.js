import { useEffect, useState } from 'react';
import SPWMini from 'spwmini/client';
import { SPW_APP_ID } from './spw-app-config.js';
import { embeddedHost } from './embedded-host.js';

const SPW_ORIGIN = 'https://spworlds.ru';
const appId = SPW_APP_ID;
const validatePath = (import.meta.env.VITE_SPW_VALIDATE_URL || '').trim();
const UUID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const USER_KEYS = new Set([
  'accountId', 'username', 'minecraftUUID', 'timestamp', 'roles', 'isAdmin', 'hash',
]);

const textWithin = (value, max) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

export function isSPWUserData(user) {
  return Boolean(
    user && typeof user === 'object' && !Array.isArray(user) &&
    Object.keys(user).every((key) => USER_KEYS.has(key)) &&
    textWithin(user.accountId, 128) &&
    textWithin(user.username, 64) &&
    typeof user.minecraftUUID === 'string' && UUID.test(user.minecraftUUID) &&
    Number.isSafeInteger(user.timestamp) && user.timestamp > 0 &&
    Array.isArray(user.roles) && user.roles.length <= 64 &&
    user.roles.every((role) => textWithin(role, 128)) &&
    typeof user.isAdmin === 'boolean' &&
    typeof user.hash === 'string' && /^[a-f0-9]{64}$/.test(user.hash)
  );
}

// SPWMini 1.2.0 has no origin/source check and its dispose() removes a
// freshly bound function. Override only its transport lifecycle; keep the SDK
// user/ready emitter and validateUser() implementation.
export class SPWMiniIdentityAdapter extends SPWMini {
  messageListener = null;

  initialize() {
    if (this.messageListener) return;
    this.messageListener = (event) => {
      if (event.source !== window.parent || event.origin !== SPW_ORIGIN) return;
      if (this.isReady || !event.data || typeof event.data !== 'object') return;
      const { type, payload } = event.data;
      if (type === 'initResponse' && isSPWUserData(payload)) {
        this.emit('initResponse', payload);
      } else if (type === 'initError' && textWithin(payload, 1000)) {
        this.emit('initError', payload);
      }
    };
    window.addEventListener('message', this.messageListener);
    window.parent.postMessage({ type: 'init', payload: this.appId }, SPW_ORIGIN);
  }

  dispose() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    this.off();
  }
}

const initialState = {
  mode: 'demo', isEmbedded: false, status: 'demo',
  user: null, verified: false, error: null,
};

export default function useSPWMini({ verifyIdentity = null } = {}) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    const embedded = window.parent !== window;
    const host = embeddedHost({embedded,referrer:document.referrer,search:window.location.search});
    if (!embedded || host === 'huevo') {
      setState(initialState);
      return;
    }
    const base = { ...initialState, mode: 'miniapp', isEmbedded: true };
    if (!UUID.test(appId)) {
      setState({ ...base, status: 'unconfigured', error: 'Мини-приложение пока не подключено.' });
      return;
    }

    let active = true;
    let hostTimer;
    let verifyTimer;
    let sessionTimer;
    const controller = new AbortController();
    const commit = (next) => {
      if (active) setState({ ...base, ...next });
    };
    const sdk = new SPWMiniIdentityAdapter(appId, {
      autoinit: false,
      customFetch: async (url, options) => {
        const response = await window.fetch(url, options);
        if (!response.ok) throw new Error('SPW validation request failed');
        return response;
      },
    });

    commit({ status: 'connecting' });
    sdk.once('ready', async () => {
      window.clearTimeout(hostTimer);
      const claim = sdk.user;
      if (!isSPWUserData(claim)) {
        commit({ status: 'error', error: 'Не удалось получить профиль.' });
        return;
      }
      // Display data only. Roles/admin and the signature never enter UI state.
      const user = {
        accountId: claim.accountId,
        username: claim.username,
        minecraftUUID: claim.minecraftUUID,
      };
      if (verifyIdentity) {
        commit({ status: 'verifying', user });
        verifyTimer = window.setTimeout(() => controller.abort(), 10000);
        try {
          const identity = await verifyIdentity(claim, { signal: controller.signal });
          if (!active) return;
          if (!identity?.authenticated || identity.profile?.accountId !== claim.accountId) {
            throw new Error('Session identity mismatch');
          }
          commit({ status: 'verified', user: identity.profile, verified: true,
            capabilities: identity.capabilities, sessionExpiresAt: identity.expiresAt });
          sessionTimer = window.setTimeout(() => commit({ status:'expired', user:identity.profile,
            verified:false, capabilities:[], error:'Сеанс завершён. Открой мини-приложение заново для входа.' }),
            Math.max(0, identity.expiresAt - Date.now()));
        } catch (failure) {
          commit({ status: 'error', user, error: failure?.code === 'AUTH_UNCONFIGURED'
            ? 'Вход на сервере ещё не настроен.' : 'Не удалось подтвердить вход на сервере.' });
        } finally {
          window.clearTimeout(verifyTimer);
        }
        return;
      }
      if (!validatePath) {
        commit({ status: 'unverified', user });
        return;
      }
      if (!validatePath.startsWith('/') || validatePath.startsWith('//')) {
        commit({ status: 'error', user, error: 'Проверка профиля пока недоступна.' });
        return;
      }
      const endpoint = new URL(validatePath, window.location.origin);
      if (endpoint.origin !== window.location.origin) {
        commit({ status: 'error', user, error: 'Проверка профиля пока недоступна.' });
        return;
      }
      commit({ status: 'verifying', user });
      verifyTimer = window.setTimeout(() => controller.abort(), 10000);
      try {
        const valid = await sdk.validateUser(endpoint.href, {
          method: 'POST',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        commit(valid
          ? { status: 'verified', user, verified: true }
          : { status: 'rejected', error: 'Не удалось подтвердить профиль.' });
      } catch {
        commit({ status: 'error', user, error: 'Проверка профиля пока недоступна.' });
      } finally {
        window.clearTimeout(verifyTimer);
      }
    });
    sdk.once('initError', () => {
      window.clearTimeout(hostTimer);
      commit({ status: 'error', error: 'Не удалось подключиться к SP Worlds.' });
    });
    hostTimer = window.setTimeout(() => {
      commit({ status: 'error', error: 'SP Worlds не ответил. Демо остаётся доступно.' });
      sdk.dispose();
    }, 10000);

    // Event handlers above must exist before sending init.
    sdk.initialize();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(hostTimer);
      window.clearTimeout(verifyTimer);
      window.clearTimeout(sessionTimer);
      sdk.dispose();
    };
  }, [verifyIdentity]);

  return state;
}


