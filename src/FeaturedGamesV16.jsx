import React from 'react';
import './FeaturedGamesV16.css';

const games = [
  { id: 'lecipher', name: 'LeXof', cover: '/hall-lexof-cover-v12.webp', theme: 'fox' },
  { id: 'maskhouse', name: 'Mask Hou$e', cover: '/maskhouse-cover-v13.webp', theme: 'house' },
  { id: 'slots', name: 'Bonanza', cover: '/hall-bonanza-cover-v12.webp', theme: 'bonanza' },
];

function FeaturedCard({ game, main = false, onOpen, locked }) {
  return <button
    type="button"
    className={`featured20-card featured20-card-${game.theme}${main ? ' featured20-card-main' : ''}`}
    disabled={locked}
    onClick={() => onOpen(game.id)}
    aria-label={`Играть в ${game.name}`}
  >
    <span className="featured20-picture">
      <img src={game.cover} width="960" height="540" alt="" decoding="async" draggable="false" />
    </span>
    <span className="featured20-plate">
      <strong>{game.name}</strong>
      <span className="featured20-play">Играть <span aria-hidden="true">↗</span></span>
    </span>
  </button>;
}

export default function FeaturedGamesV16({ onOpen, locked = false }) {
  return <section className="featured20" aria-labelledby="featured20-title">
    <div className="featured20-heading">
      <h2 id="featured20-title">Слоты</h2>
      <span className="featured20-rule" aria-hidden="true" />
    </div>
    <div className="featured20-mosaic">
      <FeaturedCard game={games[0]} main onOpen={onOpen} locked={locked} />
      <div className="featured20-side">
        {games.slice(1).map(game => <FeaturedCard key={game.id} game={game} onOpen={onOpen} locked={locked} />)}
      </div>
    </div>
  </section>;
}
