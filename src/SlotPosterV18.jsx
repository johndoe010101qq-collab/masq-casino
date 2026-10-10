import React from 'react';
import AnonymousMaskV18 from './AnonymousMaskV18.jsx';
import './SlotPosterV18.css';

const INK='#171719',PAPER='#eee7d6',WINE='#b53e55',BRASS='#c5a36a';
const TITLES={slots:'Bonanza',maskhouse:'Mask Hou$e',lecipher:'LeXof'};

function Laptop({x=0,y=0,scale=1}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={INK} strokeWidth="5" strokeLinejoin="round">
    <rect x="8" y="6" width="160" height="112" rx="4" fill={BRASS} />
    <rect x="21" y="18" width="134" height="86" fill={INK} strokeWidth="2" />
    <AnonymousMaskV18 x="65" y="24" width="49" height="64" />
    <path d="M8 118L-9 153H185L168 118Z" fill={PAPER} />
    <path d="M22 127H155M17 139H162M43 124L37 144M70 124L67 144M98 124V144M125 124L130 144M149 125L154 144" strokeWidth="2" />
  </g>;
}

function Usb({x=0,y=0,angle=0}) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`} stroke={INK} strokeWidth="5" strokeLinejoin="round">
    <rect x="0" y="26" width="61" height="105" rx="5" fill={WINE} />
    <path d="M7 26V0H53V26Z" fill={PAPER} />
    <path d="M19 8V18M41 8V18" strokeWidth="7" />
    <path d="M14 45H47M14 53H35" stroke={PAPER} strokeWidth="3" />
  </g>;
}

function Chip({x=0,y=0}) {
  return <g transform={`translate(${x} ${y})`} stroke={INK} strokeWidth="4" strokeLinejoin="round">
    <rect x="0" y="0" width="91" height="76" rx="4" fill={BRASS} />
    <rect x="13" y="13" width="65" height="50" fill={WINE} strokeWidth="3" />
    <path d="M17 -12V0M37 -12V0M57 -12V0M77 -12V0M17 76V88M37 76V88M57 76V88M77 76V88M-12 17H0M-12 38H0M-12 59H0M91 17H103M91 38H103M91 59H103" />
    <path d="M27 29H61M27 40H51M27 50H61" stroke={PAPER} strokeWidth="3" />
  </g>;
}

function BonanzaArt() {
  return <>
    <rect width="640" height="360" fill={PAPER} />
    <path d="M451 0H640V360H338L407 282L379 186Z" fill={WINE} />
    <path d="M15 18H167M15 27H167M15 36H98M564 328H621M583 337H621" stroke={INK} strokeWidth="2" />
    <path d="M15 309L151 281L189 300L304 281L339 302L390 286" fill="none" stroke={INK} strokeWidth="3" />
    <g transform="translate(46 143) rotate(-11 91 75)"><Laptop scale="1.06" /></g>
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      <path d="M239 260C213 242 206 207 209 175C211 135 249 85 294 62C347 78 382 127 388 174C392 205 383 235 363 264L374 331H216Z" fill={INK} />
      <path d="M237 175C240 133 265 101 293 87C331 99 360 136 361 177L345 253H253Z" fill={WINE} />
      <path d="M244 248L297 280L348 248L363 333H228Z" fill={PAPER} />
      <path d="M220 265L252 252L275 332H204ZM350 250L376 270L395 334H324Z" fill={WINE} />
      <path d="M288 272V326M264 295L270 319M331 291L325 318" strokeWidth="3" />
    </g>
    <AnonymousMaskV18 x="247" y="117" width="102" height="127" />
    <Usb x="479" y="60" angle="15" />
    <Chip x="476" y="242" />
    <path d="M184 53L198 71M199 46L208 66M190 223L213 226M408 119L424 105M407 140L432 133" stroke={INK} strokeWidth="3" />
  </>;
}

function HouseArt() {
  return <>
    <rect width="640" height="360" fill={WINE} />
    <path d="M0 0H171L151 99L176 185L132 260L148 360H0ZM464 0H640V360H526L492 275L518 180L477 89Z" fill={PAPER} />
    <path d="M182 22H469M196 31H451M214 40H435" stroke={INK} strokeWidth="2" />
    <g transform="rotate(-8 111 201)" stroke={INK} strokeWidth="5" strokeLinejoin="round">
      <path d="M35 300V113Q35 66 106 56Q179 65 179 113V300Z" fill={BRASS} />
      <path d="M54 299V117Q54 81 106 76Q160 82 160 117V299Z" fill={INK} />
      <rect x="69" y="145" width="77" height="133" fill={WINE} strokeWidth="3" />
      <circle cx="132" cy="216" r="5" fill={BRASS} strokeWidth="2" />
    </g>
    <AnonymousMaskV18 x="70" y="119" width="70" height="88" />
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      <path d="M229 282L268 249H362L405 283L427 360H201Z" fill={BRASS} />
      <path d="M265 251L315 288L363 251L350 354H281Z" fill={PAPER} />
      <path d="M231 271L261 250L290 355H207ZM366 251L396 272L422 355H337Z" fill={INK} />
      <path d="M289 283L315 292L339 283L342 309L315 300L289 310Z" fill={WINE} />
      <path d="M237 95L246 25L370 25L382 95Z" fill={INK} />
      <path d="M243 75H374V94H241Z" fill={WINE} strokeWidth="3" />
      <path d="M216 92C266 80 355 80 403 94L398 112C345 126 260 123 219 108Z" fill={INK} />
      <path d="M316 319V345M235 320L253 327M376 322L395 315" strokeWidth="3" />
    </g>
    <AnonymousMaskV18 x="247" y="109" width="139" height="166" />
    <g transform="rotate(12 549 190)">
      <path d="M496 101H607V273L551 302L487 262Z" fill={BRASS} stroke={INK} strokeWidth="4" />
      <AnonymousMaskV18 x="498" y="124" width="100" height="125" />
    </g>
    <path d="M15 329L51 325L69 330L96 326M458 331L488 324L510 333L544 326L570 333L620 326" fill="none" stroke={INK} strokeWidth="3" />
  </>;
}

function FoxArt() {
  return <>
    <rect width="640" height="360" fill={PAPER} />
    <path d="M0 0H231L169 66L181 163L111 218L147 360H0Z" fill={WINE} />
    <path d="M539 0H640V360H603L575 260L597 185L553 110Z" fill={BRASS} />
    <path d="M251 19H424M251 28H424M251 37H339" stroke={INK} strokeWidth="2" />
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
      <circle cx="168" cy="180" r="77" fill={BRASS} />
      <circle cx="168" cy="180" r="63" fill={PAPER} strokeWidth="3" />
      <path d="M168 129L141 173L168 196L195 173Z" fill={WINE} strokeWidth="3" />
      <path d="M168 196V228M141 179L168 216L195 179" fill="none" strokeWidth="3" />
      <path d="M414 262C496 294 539 282 555 219C578 267 572 303 539 324C506 348 448 334 411 310Z" fill={BRASS} />
      <path d="M554 220C569 247 576 279 556 301L531 286L532 269L545 251Z" fill={PAPER} strokeWidth="3" />
      <path d="M332 236L375 209L426 230L458 310L432 334H326L303 309Z" fill={INK} />
      <path d="M350 252L377 259L406 245L417 317H337Z" fill={PAPER} />
      <path d="M339 238L354 253L342 320L314 304ZM410 238L433 254L446 304L417 322Z" fill={WINE} />
      <path d="M339 316L338 350L306 350L310 334ZM398 316L407 347H445L431 332Z" fill={INK} />
      <path d="M321 83L315 32L361 64ZM396 63L438 26L435 89Z" fill={BRASS} />
      <path d="M326 64L323 44L342 62ZM416 65L432 41L430 75Z" fill={WINE} strokeWidth="3" />
      <path d="M297 170C292 126 318 81 371 56C421 71 448 118 442 165L420 223L370 249L316 220Z" fill={INK} />
      <path d="M321 123Q372 92 419 127L423 195L379 225L332 206Z" fill={BRASS} strokeWidth="3" />
      <path d="M318 218L344 202L370 221L416 202L433 229L387 249L341 242Z" fill={WINE} />
      <path d="M421 226L451 253L450 274L427 253Z" fill={WINE} strokeWidth="3" />
      <path d="M325 275L304 285L306 314L328 309ZM437 271L458 283L453 312L435 306Z" fill={PAPER} strokeWidth="3" />
    </g>
    <AnonymousMaskV18 x="326" y="104" width="103" height="128" />
    <path d="M262 164L275 158M262 178L281 178M281 272L292 260M472 132L493 116M478 150L503 141M20 327H152M35 337H123" stroke={INK} strokeWidth="3" />
  </>;
}

const ART={slots:BonanzaArt,maskhouse:HouseArt,lecipher:FoxArt};

export function SlotArtworkV18({game,className='',...props}) {
  const Art=ART[game];
  if(!Art)return null;
  return <svg className={`slot-artwork18 slot-artwork18-${game} ${className}`} viewBox="0 0 640 360" width="640" height="360"
    fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" {...props}><Art /></svg>;
}

export default function SlotPosterV18({game,className='',showTitle=false}) {
  if(!ART[game])return null;
  return <div className={`slot-poster18 slot-poster18-${game} ${className}`} aria-hidden={showTitle?undefined:true}>
    <SlotArtworkV18 game={game} />
    {showTitle && <strong className="slot-poster18-title">{TITLES[game]}</strong>}
  </div>;
}
