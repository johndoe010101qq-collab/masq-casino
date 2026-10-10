import React, {useState} from 'react';
import useSPWMini from './integrations/useSPWMini.js';
import {createServerAdminClient} from './integrations/server-admin-client.js';
import {SPW_APP_URL} from './integrations/spw-app-config.js';
import ServerAdminPanel from './ServerAdminPanel.jsx';
import './ServerAdminPage.css';

export default function ServerAdminPage({getProfileDetails}) {
  const [client] = useState(() => createServerAdminClient());
  const profile = useSPWMini({verifyIdentity:client.authenticate});
  const [closed, setClosed] = useState(false);
  const [expired, setExpired] = useState(false);
  const allowed = profile.verified && profile.capabilities?.includes('settings:read') && client.authenticated && !expired;
  const connecting = ['connecting','verifying'].includes(profile.status);
  return <main className="server-admin-page">
    <a className="server-admin-page-brand" href="/">MASQ<span>.</span></a>
    <section className="server-admin-entry-card" aria-labelledby="server-admin-page-title">
      <span className="server-admin-entry-kicker">Управление</span>
      <h1 id="server-admin-page-title">Администратор MASQ</h1>
      <p>Настройки хранятся на сервере. Доступ подтверждается через SPWorlds.</p>
      {!profile.isEmbedded ? <><p>Открой приложение в SPWorlds под аккаунтом владельца. Внешняя ссылка на эту страницу не даёт права администратора.</p><a className="server-admin-open-spw" href={SPW_APP_URL}>Открыть в SPWorlds</a></>
        : connecting ? <p role="status">{profile.status === 'connecting' ? 'Подключение к SPWorlds…' : 'Проверка входа на сервере…'}</p>
        : expired ? <p role="alert">Сеанс завершён. Открой мини-приложение заново для входа.</p>
        : allowed ? <><p>Вход выполнен: {profile.user?.username}</p><button type="button" className="server-admin-open-spw" onClick={()=>setClosed(false)}>Открыть панель управления</button></>
        : <p role="alert">{profile.error || (profile.verified ? 'У этого аккаунта нет прав управления MASQ.' : 'Серверный вход пока недоступен.')}</p>}
      <p className="server-admin-entry-footnote">Игровой сервер и платежи ещё не подключены. Настройки сохраняются для подключения к нему.</p>
    </section>
    {allowed && !closed && <ServerAdminPanel client={client} getProfileDetails={getProfileDetails} onClose={()=>setClosed(true)} onSessionExpired={()=>{client.logout();setExpired(true);}}/>}
  </main>;
}
