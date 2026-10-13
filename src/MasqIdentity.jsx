import React from 'react';

// The original supplied Minecraft skin is also the brand's physical cube mark.
export function MasqMark({ flat = false }) {
  return <span className={'masq-mark'+(flat?' masq-mark-flat':'')} aria-hidden="true">
    <i className="masq-mark-front"/><i className="masq-mark-side"/><i className="masq-mark-top"/>
  </span>;
}

const shapes={
  all:'M2 2h8v8H2z M14 2h8v8h-8z M2 14h8v8H2z M14 14h8v8h-8z',
  slots:'M4 3h16v3H4z M4 7h4v10H4z M10 7h4v10h-4z M16 7h4v10h-4z M4 18h16v3H4z',
  classics:'M3 8h3v13H3z M7 3h14v18H7z M10 6h8v3h-8z M12 11h4v7h-4z',
  rules:'M4 2h13v3H4z M4 5h3v17H4z M7 19h13v3H7z M17 5h3v14h-3z M9 8h6v2H9z M9 12h6v2H9z M9 16h6v2H9z',
  sound:'M2 9h4v6H2z M6 7h3v10H6z M9 4h3v16H9z M15 8h3v8h-3z M19 5h3v14h-3z',
  music:'M8 3h13v3H8z M8 6h3v12H8z M18 6h3v10h-3z M3 16h8v5H3z M13 14h8v5h-8z',
  arrow:'M3 11h13v3H3z M12 5h3v3h-3z M15 8h3v3h-3z M18 11h3v3h-3z M15 14h3v3h-3z M12 17h3v3h-3z',
};
export function MasqIcon({ name='all' }) {
  return <svg className="masq-pixel-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d={shapes[name]||shapes.all}/></svg>;
}
