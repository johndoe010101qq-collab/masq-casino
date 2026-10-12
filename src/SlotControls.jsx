import React from 'react';
import { BONANZA_STAKE_LIMITS, permittedStake } from './stake-limits.js';
import { BONANZA_DEMO_RULES } from './bonanza.js';
import './SlotControls.css';
import './RasterSlotControls.css';
import './SlotDock.css';

const money = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
});

function shownAmount(value, currency) {
  return Number.isFinite(value) && value >= 0
    ? money.format(value) + ' ' + currency
    : '—';
}

export default function SlotControls({
  stake,
  balance,
  lastPayout = 0,
  currency = 'АР',
  busy = false,
  disabled = false,
  skipDisabled = disabled,
  soundEnabled = false,
  musicEnabled = false,
  showAudioControls = true,
  reducedMotion = false,
  canSpin = true,
  canBuyBonus = true,
  bonusMode = null,
  stakeLimits = BONANZA_STAKE_LIMITS,
  buyAtlasUrl,
  buyArtwork,
  spinArtwork,
  onStakeChange,
  onSpin,
  onBuyBonus,
  onSkip,
  onSound,
  onMusic,
  onInfo,
  className = '',
}) {
  const validStake = permittedStake(stake, stakeLimits);
  const validBalance = Number.isFinite(balance) && balance >= 0;
  const bonusCost = validStake ? stake * BONANZA_DEMO_RULES.bonusBuyMultiplier : null;
  const spinCost = validStake ? stake * (bonusMode?.multiplier || 1) : null;
  const locked = Boolean(disabled || busy);
  const stakeCallback = typeof onStakeChange === 'function';
  const spinReady = !locked && validStake && validBalance
    && balance >= spinCost && canSpin && typeof onSpin === 'function';
  const buyReady = !locked && validStake && validBalance
    && balance >= bonusCost && canBuyBonus
    && typeof onBuyBonus === 'function';
  const skipReady = busy && !skipDisabled && typeof onSkip === 'function';

  function changeStake(direction) {
    if (locked || !validStake || !stakeCallback) return;
    const nextStake = stake + direction * stakeLimits.step;
    if (!permittedStake(nextStake, stakeLimits)) return;
    onStakeChange(nextStake);
  }

  function spin() {
    if (spinReady) onSpin();
  }

  function buyBonus() {
    if (buyReady) onBuyBonus({ stake, cost: bonusCost });
  }

  function skip() {
    if (skipReady) onSkip();
  }

  const buyTitle = busy
    ? 'Дождитесь завершения раунда'
    : bonusMode ? 'Бонусный режим включён до отмены'
    : validStake && validBalance && balance < bonusCost
      ? 'Недостаточно средств для покупки бонуса'
      : 'Купить 10 бесплатных вращений';

  return (
    <div className="slot-controls-shell">
      <section
        className={'slot-controls ' + className}
        data-busy={busy ? 'true' : 'false'}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        aria-label="Управление слотом"
        aria-busy={busy}
      >
        <button
          className="slot-buy-button"
          type="button"
          disabled={!buyReady}
          onClick={buyBonus}
          title={buyTitle}
          aria-label={'Купить бонус. Стоимость: '
            + shownAmount(bonusCost, currency)}
        >
          {buyAtlasUrl ? (
            <span className="slot-buy-art slot-buy-sprite" aria-hidden="true"
              style={{ backgroundImage: 'url(' + buyAtlasUrl + ')' }} />
          ) : buyArtwork ? (
            <img className="slot-buy-art" src={buyArtwork}
              alt="" aria-hidden="true" draggable="false" />
          ) : null}
          <span className="slot-buy-copy">
            <span className="slot-buy-label">{bonusMode?'Бонус включён':'Купить бонус'}</span>
            <span className="slot-buy-price">
              <span>{shownAmount(bonusCost, currency)}</span>
            </span>
            <span className="slot-buy-detail">10 бесплатных вращений</span>
          </span>
        </button>

        <div className="slot-totals">
          <div className="slot-total slot-last-payout">
            <span className="slot-total-label">Последняя выплата</span>
            <output className="slot-total-value"
              aria-label="Последняя выплата"
              aria-live="polite" aria-atomic="true">
              {shownAmount(lastPayout, currency)}
            </output>
          </div>
        </div>

        <div className="slot-stake-control" role="group"
          aria-label="Ставка">
          <span className="slot-stake-caption">Ставка</span>
          <div className="slot-stake-row">
            <button type="button" className="slot-stake-step"
              disabled={locked || !validStake || !stakeCallback || stake <= stakeLimits.min}
              onClick={() => changeStake(-1)}
              aria-label={'Уменьшить ставку на 5 ' + currency}>−</button>
            <output className="slot-stake-value"
              aria-label="Текущая ставка" aria-live="polite"
              aria-atomic="true">
              {shownAmount(validStake ? stake : null, currency)}
            </output>
            <button type="button" className="slot-stake-step"
              disabled={locked || !validStake || !stakeCallback || stake >= stakeLimits.max}
              onClick={() => changeStake(1)}
              aria-label={'Увеличить ставку на 5 ' + currency}>+</button>
          </div>
        </div>

        <button className="slot-spin-button"
          type="button" disabled={!spinReady} onClick={spin}
          aria-label={busy ? 'Раунд выполняется' : (bonusMode?'Запустить бонус за ':'Прокрутить слот за ')+shownAmount(spinCost,currency)}
          title={busy ? 'Раунд выполняется' : (bonusMode?'Запустить бонус за ':'Прокрутить слот за ')+shownAmount(spinCost,currency)}>
          <span className="slot-spin-face">
            {spinArtwork ? (
              <img src={spinArtwork} className="slot-spin-art"
                alt="" aria-hidden="true" draggable="false" />
            ) : null}
            <span className="slot-spin-arrow" aria-hidden="true">↻</span>
            <span className="slot-spin-word">{busy ? 'Идёт игра' : bonusMode?shownAmount(spinCost,currency):'Крутить'}</span>
          </span>
        </button>

        <div className="slot-utility-controls">
        <div className="slot-tool-buttons" role="group"
          aria-label="Звук и правила">
          {showAudioControls && <button type="button" className="slot-tool-button"
            disabled={disabled || typeof onSound !== 'function'}
            aria-pressed={Boolean(soundEnabled)}
            aria-label={soundEnabled ? 'Выключить звуки' : 'Включить звуки'}
            title={soundEnabled ? 'Выключить звуки' : 'Включить звуки'}
            onClick={() => {
              if (!disabled && typeof onSound === 'function') {
                onSound(!soundEnabled);
              }
            }}>
            <span className="slot-audio-dot" aria-hidden="true" />
            <span>Звук</span>
          </button>}
          {showAudioControls && <button type="button" className="slot-tool-button"
            disabled={disabled || typeof onMusic !== 'function'}
            aria-pressed={Boolean(musicEnabled)}
            aria-label={musicEnabled ? 'Выключить музыку' : 'Включить музыку'}
            title={musicEnabled ? 'Выключить музыку' : 'Включить музыку'}
            onClick={() => {
              if (!disabled && typeof onMusic === 'function') {
                onMusic(!musicEnabled);
              }
            }}>
            <span className="slot-audio-dot" aria-hidden="true" />
            <span>Музыка</span>
          </button>}
          <button type="button" className="slot-tool-button slot-info-button"
            disabled={disabled || typeof onInfo !== 'function'}
            aria-label="Открыть правила слота" title="Правила слота"
            onClick={() => {
              if (!disabled && typeof onInfo === 'function') onInfo();
            }}>
            <span>Правила</span>
          </button>
        </div>

        <button type="button" className="slot-skip-button"
          disabled={!skipReady} onClick={skip}
          aria-label="Пропустить анимацию текущего раунда"
          title="Пропустить анимацию текущего раунда">
          Пропустить
        </button>
        </div>
        {bonusMode&&<div className="slot-dock-feature slot-bonus-mode" role="status">
          <span><strong>{bonusMode.name}</strong> · каждый запуск {shownAmount(spinCost,currency)}</span>
          <button type="button" onClick={bonusMode.onDisable}>Отменить бонус</button>
        </div>}
      </section>
    </div>
  );
}
