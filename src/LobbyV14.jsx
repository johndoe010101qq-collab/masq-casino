import React, { useId, useState } from 'react';
import { GAME_META } from './game-meta.js';
import SlotHallArt from './SlotHallArt.jsx';
import './LobbyV14.css';

const SLOT_IDS = Object.freeze(['slots', 'maskhouse', 'lecipher']);
const CLASSIC_COVERS = Object.freeze({
  coinflip: '/coinflip-crest.png',
  dice: '/dice-crest.png',
  plinko: '/plinko-crest.png',
  roulette: '/roulette-minimal.png',
  upgrader: '/upgrader-ink.png',
  blackjack: '/blackjack-minimal.png',
});
const SEARCH_NAMES = Object.freeze({
  slots: 'бонанза bonanza каскады',
  maskhouse: 'маск хаус маскхаус mask house маски вайлд wild',
  lecipher: 'лексоф лексофф lexof лис le bandit ле бандит радуга',
  coinflip: 'коинфлип coin flip монета',
  dice: 'дайс дайсы кубик кости',
  plinko: 'плинко шары',
  roulette: 'рулетка рулетка зеро',
  upgrader: 'апгрейдер апгрейд улучшение терминал',
  blackjack: 'блэкджек блекджек блэк джек блек джек карты двадцать одно',
});
const CATEGORY_OPTIONS = Object.freeze([
  { id: 'all', label: 'Все игры' },
  { id: 'slots', label: 'Слоты' },
  { id: 'classics', label: 'Классика' },
]);
const normalize = value => String(value ?? '').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();

export function filterLobbyGames({ category = 'all', query = '' } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return GAME_META.filter(game => {
    const isSlot = SLOT_IDS.includes(game.id);
    if (category === 'slots' && !isSlot) return false;
    if (category === 'classics' && isSlot) return false;
    const searchable = normalize([game.name, game.description, SEARCH_NAMES[game.id]].join(' '));
    return words.every(word => searchable.includes(word));
  });
}

function Arrow({ diagonal = false, className = '' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    {diagonal
      ? <path d="M6 18 18 6M6 6h12v12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.7" />
    <path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>;
}

function GameTile({ game, slot, onOpen, locked, index }) {
  return <button type="button" className={`lobby14-game lobby14-game-${game.id} ${slot ? 'lobby14-game-slot' : 'lobby14-game-classic'}`}
    disabled={locked} aria-label={`Открыть ${game.name}`} onClick={() => onOpen(game.id)}>
    <span className="lobby14-game-art">
      {slot
        ? <SlotHallArt game={game.id} />
        : <img src={CLASSIC_COVERS[game.id]} alt="" width="1448" height="1086" loading="lazy" decoding="async" draggable="false" />}
      <span className="lobby14-game-enter" aria-hidden="true"><Arrow diagonal /></span>
    </span>
    <span className="lobby14-game-caption">
      <span className="lobby14-game-title"><strong>{game.name}</strong>{slot && <span aria-hidden="true">0{index + 1}</span>}</span>
      <span className="lobby14-game-description">{game.description}</span>
    </span>
  </button>;
}

function GameCollection({ games, title, subtitle, slot, onOpen, locked }) {
  if (!games.length) return null;
  return <section className={`lobby14-collection lobby14-collection-${slot ? 'slots' : 'classics'}`} aria-label={title}>
    <div className="lobby14-section-heading">
      <h3>{title}<span>{String(games.length).padStart(2, '0')}</span></h3>
      <p>{subtitle}</p>
    </div>
    <div className={`lobby14-game-grid lobby14-game-grid-${slot ? 'slots' : 'classics'}`}>
      {games.map((game, index) => <GameTile key={game.id} game={game} slot={slot} onOpen={onOpen} locked={locked} index={index} />)}
    </div>
  </section>;
}

export default function LobbyV14({ onOpen, onRules, locked = false, category = 'all', onCategoryChange }) {
  const [localCategory, setLocalCategory] = useState(category);
  const [query, setQuery] = useState('');
  const searchId = useId();
  const activeCategory = onCategoryChange ? category : localCategory;
  const games = filterLobbyGames({ category: activeCategory, query });
  const slots = SLOT_IDS.map(id => games.find(game => game.id === id)).filter(Boolean);
  const classics = games.filter(game => !SLOT_IDS.includes(game.id));
  function changeCategory(next) {
    if (onCategoryChange) onCategoryChange(next);
    else setLocalCategory(next);
  }
  function resetFilters() {
    setQuery('');
    changeCategory('all');
  }
  return <div className="lobby14">
    <section className="lobby14-hero" aria-labelledby="lobby14-title">
      <div className="lobby14-hero-copy">
        <span className="lobby14-eyebrow"><span className="lobby14-small-rule" aria-hidden="true" />MASQ</span>
        <h1 id="lobby14-title">Игры<br /> с характером<span>.</span></h1>
        <p className="lobby14-hero-description">Каскады, карты и золотые ячейки.<br />Найди свой следующий ход.</p>
        <button className="lobby14-feature-action" type="button" disabled={locked} onClick={() => onOpen('lecipher')}>
          Открыть LeXof <Arrow diagonal />
        </button>
        <div className="lobby14-hero-note"><span>В центре внимания</span><strong>LeXof</strong><span>Лис в маске. Париж после заката.</span></div>
      </div>
      <div className="lobby14-featured-art" aria-hidden="true">
        <SlotHallArt game="lecipher" variant="promo" />
        <div className="lobby14-poster-edge" />
        <span className="lobby14-poster-note"><span>Кластеры</span><span>Золотые ячейки</span><Arrow diagonal /></span>
      </div>
    </section>

    <section className="lobby14-catalog" id="lobby14-catalog" aria-labelledby="lobby14-catalog-title">
      <div className="lobby14-catalog-heading">
        <div><span className="lobby14-eyebrow">Коллекция MASQ</span><h2 id="lobby14-catalog-title">Игровой зал<span>09</span></h2></div>
        <label className="lobby14-search" htmlFor={searchId}>
          <SearchIcon />
          <span className="lobby14-sr-only">Найти игру</span>
          <input id={searchId} type="search" aria-label="Найти игру" placeholder="Найти игру" autoComplete="off" maxLength={80} value={query}
            onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />
          {query && <button type="button" className="lobby14-search-clear" aria-label="Очистить поиск" onClick={() => setQuery('')}>×</button>}
        </label>
      </div>
      <div className="lobby14-catalog-toolbar">
        <div className="lobby14-categories" role="group" aria-label="Категории игр">
          {CATEGORY_OPTIONS.map(option => <button key={option.id} type="button" className={activeCategory === option.id ? 'lobby14-category-active' : ''}
            aria-pressed={activeCategory === option.id} onClick={() => changeCategory(option.id)}>
            {option.label}<span>{option.id === 'all' ? '09' : option.id === 'slots' ? '03' : '06'}</span>
          </button>)}
        </div>
        <span className="lobby14-result-count" role="status" aria-live="polite" aria-atomic="true">{query ? `Найдено: ${games.length}` : 'Девять игр.'}</span>
      </div>
      {games.length ? <>
        <GameCollection games={slots} title="Слоты" subtitle="Три истории. Три разных механики." slot onOpen={onOpen} locked={locked} />
        <GameCollection games={classics} title="Классика" subtitle="Знакомые игры в нашем исполнении." onOpen={onOpen} locked={locked} />
      </> : <div className="lobby14-empty">
        <SearchIcon /><h3>Игра не найдена</h3><p>Попробуй другое название или открой всю коллекцию.</p>
        <button type="button" onClick={resetFilters}>Показать все игры <Arrow /></button>
      </div>}
    </section>

    <section className="lobby14-rules-strip" aria-label="Условия игр">
      <span className="lobby14-rules-mark" aria-hidden="true"><img src="/anonymous-mask-minimal.png" alt="" width="40" height="52" loading="lazy" /></span>
      <div><span className="lobby14-eyebrow">До первого хода</span><h2>Правила на виду.</h2><p>Выплаты, распределения и условия бонусов — в одном месте.</p></div>
      <button type="button" disabled={locked} onClick={onRules}>Правила шансов <Arrow diagonal /></button>
    </section>
  </div>;
}
