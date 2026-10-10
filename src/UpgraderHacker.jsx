import React from 'react';
import { upgradeTerminalPose, terminalCode } from './upgrader-presentation.js';
import './UpgraderHacker.css';

const fmt = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

export default function UpgraderHacker({ round, progress, playing, targetChoice = 2, reduced = false }) {
  const pose = upgradeTerminalPose(reduced && round ? 1 : playing ? progress : round ? 1 : 0, !!round);
  const revealed = pose.reveal;
  const outcome = revealed ? (round.won ? 'success' : 'denied') : 'pending';
  const title = revealed ? (round.won ? 'Доступ открыт' : 'Доступ закрыт') : pose.phase === 'idle' ? 'Готов к взлому' : pose.phase === 'connect' ? 'Подключение' : pose.phase === 'scan' ? 'Поиск ключа' : 'Расшифровка';
  const multiplier = round?.targetMultiplier ?? targetChoice;
  return <div className={'hacker-workstation outcome-' + outcome + ' terminal-phase-' + pose.phase + (playing ? ' hacking' : '')}>
    <img className="hacker-cabinet" src={import.meta.env.BASE_URL + 'upgrader-hacker-terminal.png'} alt="" aria-hidden="true" />
    <div className="hacker-screen" aria-hidden="true">
      <div className="hacker-screen-heading"><span className="hacker-status-light" /><span>{pose.phase === 'idle' ? 'ТЕРМИНАЛ' : 'СЕАНС'}</span><strong>×{fmt(multiplier)}</strong></div>
      <div className="hacker-identity">
        <div className="hacker-scan" style={{ transform: `translateY(${pose.scanY}%)`, opacity: playing && !revealed ? 1 : 0 }} />
        <img src={import.meta.env.BASE_URL + 'anonymous-mask-minimal.png'} alt="" />
        <strong className="hacker-target">×{fmt(multiplier)}</strong>
      </div>
      <div className="hacker-code">{revealed ? (round.won ? 'ACCESS GRANTED' : 'ACCESS DENIED') : terminalCode(pose.codeTick, pose.phase !== 'idle')}</div>
      <strong className="hacker-screen-title">{title}</strong>
      <div className="hacker-packets">{Array.from({ length: 12 }, (_, index) => <i key={index} className={index < pose.packets ? 'decoded' : ''} />)}</div>
    </div>
  </div>;
}
