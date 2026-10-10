import React from 'react';
import AnonymousMaskV18 from './AnonymousMaskV18.jsx';
import './ClassicPosterV17.css';

const INK = '#171719';
const PAPER = '#eee7d6';
const RED = '#b53e55';
const BRASS = '#c5a36a';

function Mask({ x, y, width, height, paper = PAPER }) {
  return <AnonymousMaskV18 x={x} y={y} width={width} height={height} paper={paper}/>;
}

function Coin() {
  return <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
    <circle cx="110" cy="135" r="95" fill={RED} />
    <path d="M27 163L42 158M33 184L49 174M47 201L61 188M67 216L77 200M92 227L96 209M116 231L117 213M141 224L136 207M164 215L153 199M182 198L166 188" strokeWidth="3" />
    <circle cx="131" cy="109" r="95" fill={BRASS} />
    <circle cx="131" cy="109" r="81" fill={PAPER} strokeWidth="3" />
    <path d="M58 60L65 69M46 85L57 89M44 112L55 112M52 143L62 138M76 169L82 159M183 54L175 63M204 86L192 90M212 119L198 119M204 147L194 140M178 176L171 165" strokeWidth="2" />
    <Mask x="80" y="40" width="103" height="137" />
  </g>;
}

function Dice() {
  const front = [[54,117],[108,141],[81,153],[54,166],[108,190]];
  return <g transform="rotate(-8 120 124)" stroke={INK} strokeWidth="6" strokeLinejoin="round">
    <path d="M35 89L107 41L207 79L130 131Z" fill={PAPER} />
    <path d="M35 89L130 131L130 223L35 181Z" fill={RED} />
    <path d="M130 131L207 79L207 171L130 223Z" fill={BRASS} />
    <ellipse cx="93" cy="73" rx="8" ry="5" fill={INK} stroke="none" />
    <ellipse cx="149" cy="96" rx="8" ry="5" fill={INK} stroke="none" />
    {front.map(([x,y],i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="8" fill={PAPER} stroke="none" />)}
    {[[149,133],[185,110],[149,183],[185,160]].map(([x,y],i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="8" fill={INK} stroke="none" />)}
    <path d="M15 51L22 74M191 34L181 49M219 209L203 205" fill="none" strokeWidth="4" />
  </g>;
}

function Plinko() {
  return <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
    <path d="M33 14H204L225 225H12Z" fill={BRASS} />
    <path d="M47 30H190L207 211H30Z" fill={PAPER} strokeWidth="3" />
    <path d="M94 43L128 75L104 101L134 125L110 151L144 182" fill="none" stroke={RED} strokeWidth="3" strokeDasharray="5 7" />
    {[0,1,2,3,4].flatMap(row => Array.from({ length:row + 3 }, (_,column) => {
      const count=row+3;
      return <circle key={`${row}-${column}`} cx={120+(column-(count-1)/2)*23} cy={69+row*26} r="4.5" fill={INK} stroke="none" />;
    }))}
    <path d="M32 188H206V210H31Z" fill={RED} strokeWidth="3" />
    <path d="M58 188V210M87 188V210M117 188V210M147 188V210M176 188V210" strokeWidth="3" />
    <circle cx="94" cy="39" r="15" fill={RED} strokeWidth="4" />
    <path d="M82 18L75 7M112 16L119 8" stroke={PAPER} strokeWidth="4" strokeLinecap="round" />
  </g>;
}

function Roulette() {
  const point=(angle,r)=>[120+Math.cos(angle)*r,120+Math.sin(angle)*r];
  return <g stroke={INK} strokeLinejoin="round">
    <circle cx="120" cy="120" r="111" fill={BRASS} strokeWidth="6" />
    {Array.from({length:37},(_,index)=>{
      const a=index*Math.PI*2/37-Math.PI/2,b=(index+1)*Math.PI*2/37-Math.PI/2;
      const [x1,y1]=point(a,97),[x2,y2]=point(b,97),[x3,y3]=point(b,62),[x4,y4]=point(a,62);
      return <path key={index} d={`M${x1} ${y1}A97 97 0 0 1 ${x2} ${y2}L${x3} ${y3}A62 62 0 0 0 ${x4} ${y4}Z`}
        fill={index===0?PAPER:index%2?RED:INK} stroke={BRASS} strokeWidth="1.5" />;
    })}
    <circle cx="120" cy="120" r="61" fill={PAPER} strokeWidth="4" />
    <Mask x="80" y="69" width="80" height="104" />
    <circle cx="177" cy="43" r="9" fill={PAPER} strokeWidth="3" />
  </g>;
}

function Upgrader() {
  return <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
    <path d="M23 32H214V169L231 218H7L23 169Z" fill={BRASS} />
    <rect x="36" y="44" width="165" height="112" rx="2" fill={INK} strokeWidth="3" />
    <Mask x="91" y="52" width="53" height="69" paper={PAPER} />
    <path d="M69 140L89 121L107 140M140 142H181M150 133H176" fill="none" stroke={PAPER} strokeWidth="4" />
    <path d="M28 176H209L217 203H20Z" fill={PAPER} strokeWidth="3" />
    <path d="M36 184H192M41 193H198M55 179L51 201M85 179L84 201M118 179V201M150 179L152 201M181 179L186 201" strokeWidth="2" />
    <path d="M2 83L18 83M214 122C240 122 232 161 240 170" fill="none" stroke={RED} strokeWidth="6" />
    <path d="M114 223H127" strokeWidth="3" />
  </g>;
}

function Blackjack() {
  return <g stroke={INK} strokeWidth="5" strokeLinejoin="round">
    <g transform="rotate(17 145 125)">
      <rect x="82" y="29" width="112" height="172" rx="4" fill={RED} />
      <rect x="91" y="38" width="94" height="154" rx="1" fill={PAPER} strokeWidth="2" />
      <path d="M138 82C124 95 112 102 112 116C112 129 125 136 138 127C151 136 164 129 164 116C164 102 152 95 138 82ZM134 126L127 148H149L142 126Z" fill={INK} strokeWidth="2" />
    </g>
    <g transform="rotate(-14 97 138)">
      <rect x="37" y="55" width="115" height="172" rx="4" fill={PAPER} />
      <path d="M56 81L62 65L68 81M59 76H65" fill="none" strokeWidth="3" />
      <path d="M122 212L128 196L134 212M125 207H131" fill="none" strokeWidth="3" />
      <path d="M95 155C86 145 62 129 62 112C62 96 83 90 95 106C107 90 128 96 128 112C128 129 104 145 95 155Z" fill={RED} strokeWidth="3" />
      <Mask x="78" y="171" width="33" height="41" />
    </g>
  </g>;
}

const SYMBOLS = {coinflip:Coin,dice:Dice,plinko:Plinko,roulette:Roulette,upgrader:Upgrader,blackjack:Blackjack};

export function ClassicSymbolV17({ game, className = '', ...props }) {
  const Symbol=SYMBOLS[game];
  if(!Symbol)return null;
  return <svg className={`classic-symbol17 classic-symbol17-${game} ${className}`} viewBox="0 0 240 240"
    width="240" height="240" fill="none" aria-hidden="true" focusable="false" {...props}><Symbol /></svg>;
}

const COMPOSITIONS={
  coinflip:{x:12,y:39,size:276,bg:PAPER},
  dice:{x:26,y:61,size:263,bg:BRASS},
  plinko:{x:21,y:34,size:271,bg:RED},
  roulette:{x:-30,y:36,size:330,bg:PAPER},
  upgrader:{x:16,y:65,size:271,bg:PAPER},
  blackjack:{x:4,y:40,size:291,bg:RED},
};

export default function ClassicPosterV17({ game }) {
  const composition=COMPOSITIONS[game];
  if(!composition)return null;
  return <svg className={`classic-poster17 classic-poster17-${game}`} viewBox="0 0 300 400" width="300" height="400"
    fill="none" aria-hidden="true" focusable="false">
    <rect width="300" height="400" fill={composition.bg} />
    {game==='coinflip' && <><path d="M-20 270L305 198V400H-20Z" fill={RED} /><path d="M12 22H83M12 30H83M12 38H48" stroke={INK} strokeWidth="2" /></>}
    {game==='dice' && <><path d="M179 0L300 0V310L134 355Z" fill={PAPER} /><path d="M-15 51L147 9M-15 61L147 19M-15 71L147 29" stroke={INK} strokeWidth="2" /><path d="M41 299L87 280L141 300L179 291" stroke={INK} strokeWidth="3" /></>}
    {game==='plinko' && <><path d="M0 0H138L54 345H0Z" fill={INK} /><path d="M220 11L280 11M234 20H280M250 29H280" stroke={PAPER} strokeWidth="2" /></>}
    {game==='roulette' && <><path d="M180 0H300V400H248L193 286Z" fill={RED} /><path d="M15 19H127M15 27H84" stroke={INK} strokeWidth="2" /><path d="M13 298L64 293L112 303L171 296" stroke={INK} strokeWidth="3" /></>}
    {game==='upgrader' && <><path d="M0 0H300V31L232 27L192 35L145 28L99 34L54 28L0 35Z" fill={INK} /><path d="M258 59V307M266 82V290M274 101V261" stroke={RED} strokeWidth="4" /></>}
    {game==='blackjack' && <><path d="M0 0H300V75L222 63L175 78L133 66L70 77L0 66Z" fill={INK} /><path d="M17 286L109 305L172 291L262 310" stroke={PAPER} strokeWidth="3" /></>}
    <ClassicSymbolV17 game={game} x={composition.x} y={composition.y} width={composition.size} height={composition.size} />
    <path d="M0 334L26 337L46 332L65 338L94 334L114 339L143 334L169 338L192 332L217 338L241 334L269 338L300 334V400H0Z" fill={PAPER} />
    <path d="M15 351H285" stroke={INK} strokeWidth="1.5" />
  </svg>;
}
