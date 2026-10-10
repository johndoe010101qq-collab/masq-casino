import React, { useEffect, useId, useState } from 'react';
import { GAME_META } from './game-meta.js';
import SlotHallArt from './SlotHallArt.jsx';
import FeaturedGamesV16 from './FeaturedGamesV16.jsx';
import './LobbyV15.css';

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
  maskhouse: 'маск хаус маскхаус mask house hou$e маски вайлд wild',
  lecipher: 'лексоф лексофф lexof лис le bandit ле бандит радуга',
  coinflip: 'коинфлип coin flip монета',
  dice: 'дайс дайсы кубик кости',
  plinko: 'плинко шары',
  roulette: 'рулетка зеро',
  upgrader: 'апгрейдер апгрейд улучшение терминал',
  blackjack: 'блэкджек блекджек блэк джек блек джек карты двадцать одно',
});
const CATEGORIES = Object.freeze([
  { id: 'all', label: 'Все игры' },
  { id: 'slots', label: 'Слоты' },
  { id: 'classics', label: 'Классика' },
]);
const normalize = value => String(value ?? '').toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim();

export function filterLobbyGames({ category = 'all', query = '' } = {}) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return GAME_META.filter(game => {
    const slot = SLOT_IDS.includes(game.id);
    if (category === 'slots' && !slot) return false;
    if (category === 'classics' && slot) return false;
    const names = normalize(`${game.name} ${SEARCH_NAMES[game.id] ?? ''}`);
    return words.every(word => names.includes(word));
  });
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <circle cx="10.5" cy="10.5" r="6.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="m15.2 15.2 4.3 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 5.5v13l10-6.5z" fill="currentColor" />
  </svg>;
}

function GameCard({ game, slot, onOpen, locked }) {
  const caption = <span className="lobby15-caption">
    <strong>{game.name}</strong>
    <span className="lobby15-enter" aria-hidden="true"><span>Играть</span><Arrow /></span>
  </span>;
  return <button type="button" className={`lobby15-card lobby15-card-${slot ? 'slot' : 'classic'} lobby15-game-${game.id}`}
    disabled={locked} aria-label={`Играть в ${game.name}`} onClick={() => onOpen(game.id)}>
    <span className="lobby15-art">
      {slot ? <SlotHallArt game={game.id} /> : <img src={CLASSIC_COVERS[game.id]} alt=""
        loading="lazy" decoding="async" draggable="false" />}
      <span className="lobby15-play" aria-hidden="true"><PlayIcon /></span>
    </span>
    {caption}
  </button>;
}

function Collection({ games, title, slot, heading, onOpen, locked }) {
  if (!games.length) return null;
  return <section className={`lobby15-collection lobby15-collection-${slot ? 'slots' : 'classics'}`} aria-label={title}>
    {heading && <div className="lobby15-collection-heading"><h2>{title}</h2></div>}
    <div className={`lobby15-grid lobby15-grid-${slot ? 'slots' : 'classics'}`}>
      {games.map(game => <GameCard key={game.id} game={game} slot={slot} onOpen={onOpen} locked={locked} />)}
    </div>
  </section>;
}

export default function LobbyV15({ onOpen, locked = false, category = 'all', onCategoryChange, onQueryChange }) {
  const [localCategory, setLocalCategory] = useState(category);
  const [query, setQuery] = useState('');
  useEffect(() => { onQueryChange?.(normalize(query)); }, [query, onQueryChange]);
  const searchId = useId();
  const requestedCategory = onCategoryChange ? category : localCategory;
  const activeCategory = CATEGORIES.some(option => option.id === requestedCategory) ? requestedCategory : 'all';
  const games = filterLobbyGames({ category: activeCategory, query });
  const slots = SLOT_IDS.map(id => games.find(game => game.id === id)).filter(Boolean);
  const classics = games.filter(game => !SLOT_IDS.includes(game.id));
  const showSlotCollection = !normalize(query) && activeCategory !== 'classics';
  const gameWord = games.length === 1 ? 'игра' : games.length >= 2 && games.length <= 4 ? 'игры' : 'игр';
  function changeCategory(next) {
    if (onCategoryChange) onCategoryChange(next);
    else setLocalCategory(next);
  }
  function resetSearch() {
    setQuery('');
    changeCategory('all');
  }
  return <section className="lobby15" id="lobby15-catalog" aria-labelledby="lobby15-title">
    <div className="lobby15-heading">
      <h1 id="lobby15-title">{activeCategory === 'all' ? 'Игры' : CATEGORIES.find(option => option.id === activeCategory).label}</h1>
      <span className="lobby15-count" aria-hidden="true">{games.length} {gameWord}</span>
    </div>
    <div className="lobby15-toolbar">
      <label className="lobby15-search" htmlFor={searchId}>
        <SearchIcon />
        <span className="lobby15-sr-only">Поиск игр</span>
        <input id={searchId} type="search" aria-label="Поиск игр" placeholder="Поиск игр" autoComplete="off" maxLength={80} value={query}
          onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); }} />
        {query && <button type="button" className="lobby15-search-clear" aria-label="Очистить поиск" onClick={() => setQuery('')}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>}
      </label>
      <div className="lobby15-filters" role="group" aria-label="Категории игр">
      {CATEGORIES.map(option => <button key={option.id} type="button" aria-pressed={activeCategory === option.id}
        className={activeCategory === option.id ? 'lobby15-filter-active' : ''} onClick={() => changeCategory(option.id)}>{option.label}</button>)}
      </div>
    </div>
    <span className="lobby15-sr-only" role="status" aria-live="polite" aria-atomic="true">Найдено игр: {games.length}</span>
    {games.length ? <>
      {showSlotCollection ? <FeaturedGamesV16 onOpen={onOpen} locked={locked} /> : <Collection games={slots} title="Слоты" slot heading={activeCategory === 'all'} onOpen={onOpen} locked={locked} />}
      <Collection games={classics} title="Классика" heading={activeCategory === 'all'} onOpen={onOpen} locked={locked} />
    </> : <div className="lobby15-empty">
      <SearchIcon /><h2>Ничего не найдено</h2>
      <button type="button" onClick={resetSearch}>Сбросить поиск <Arrow /></button>
    </div>}
  </section>;
}
