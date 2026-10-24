import React,{useEffect,useRef,useState} from 'react';
import {BONANZA_DEMO_RULES} from './bonanza.js';
import {MASK_SLOT_RULES} from './mask-slots.js';
import {CURRENCY} from './currency.js';
import {HUEVO_RTP} from './runtime-rtp-range.js';
import {SpinArrow} from './OriginalSlotControls.jsx';
import {adjustedStake} from './stake-limits.js';
import './OriginalSlots.css';
const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const base=import.meta.env.BASE_URL||'/';

export function OriginalSymbol({atlas,kind,className=''}){
 if(!atlas)return null;const i=atlas.indices[kind];
 return <span className={'slot-sprite '+className} role="img" aria-label={atlas.names?.[kind]} style={{backgroundImage:`url('${atlas.url}')`,backgroundPosition:`${i%4/3*100}% ${Math.floor(i/4)/2*100}%`}}/>;
}
export function OriginalDialog({game,opened=true,onClose,label,children,className=''}){
 const ref=useRef(null),latest=useRef(onClose);latest.current=onClose;
 useEffect(()=>{const node=ref.current;if(!node)return;const previous=document.activeElement;if(opened&&!node.open)node.showModal();else if(!opened&&node.open)node.close();return()=>{if(node.open)node.close();if(previous?.isConnected)previous.focus?.({preventScroll:true});};},[opened]);
 return <dialog ref={ref} className={'original-slot-dialog original-slot-dialog--'+game+' '+className} aria-label={label} onCancel={e=>{e.preventDefault();latest.current?.();}} onKeyDown={e=>{if(e.key!=='Tab')return;const nodes=[...e.currentTarget.querySelectorAll('button,input,[tabindex]')].filter(n=>!n.disabled&&n.getClientRects().length);if(!nodes.length)return;if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}}>
  <button className="original-dialog-close" type="button" aria-label="Закрыть окно" onClick={onClose}>×</button>{children}
 </dialog>;
}

export function OriginalSlotIntro({game,opened,atlas,onContinue}){
 const [skip,setSkip]=useState(false);
 const leave=()=>{if(skip)try{localStorage.setItem('masq-original-intro-'+game,'skip');}catch{}onContinue();};
 useEffect(()=>{try{if(localStorage.getItem('masq-original-intro-'+game)==='skip')onContinue();}catch{}},[game]);
 return <OriginalDialog game={game} opened={opened&&!!atlas} onClose={leave} label="Добро пожаловать в Bonanza" className={'original-intro original-intro--'+game}>
  <h2>{game==='slots'?'Bonanza':'LeXof'}</h2>
  <div className="original-intro-preview" aria-hidden="true">{Array.from({length:30},(_,i)=><OriginalSymbol key={i} atlas={atlas} kind={['key','flag','laptop','usb','hood','radio','scatter','suit','glove'][i%9]}/>)}</div>
  <button className="original-intro-start" type="button" onClick={leave} aria-label="Продолжить в игру"><SpinArrow/></button>
  <label className="original-intro-check"><input type="checkbox" checked={skip} onChange={e=>setSkip(e.target.checked)}/>БОЛЬШЕ НЕ ПОКАЗЫВАТЬ</label>
  <p>{game==='slots'?'СИМВОЛЫ ПЛАТЯТ В ЛЮБОМ МЕСТЕ ЭКРАНА':'КАСКАДЫ · ЗОЛОТЫЕ КЛЕТКИ · ТРИ БОНУСА'}</p>
 </OriginalDialog>;
}

export function OriginalPurchase({game,request,onCancel,onConfirm}){
 if(!request)return null;const count=request.freeSpins??request.bonus?.initialFreeSpins??'9–27';
 return <OriginalDialog game={game} onClose={onCancel} label="Подтверждение покупки бонуса">
  <h2>{game==='lecipher'?request.bonus?.id==='gold'?'ALL THAT GLITTERS IS GOLD':'LUCK OF THE BANDIT':'БЕСПЛАТНЫЕ ВРАЩЕНИЯ'}</h2>
  <p className="original-confirm-copy">КУПИТЬ <strong>{count}</strong><br/>БЕСПЛАТНЫХ ВРАЩЕНИЙ<br/>ЗА <strong>{money(request.cost)} {CURRENCY}</strong>?</p>
  <p className="original-confirm-note">Базовая ставка: {money(request.stake)} {CURRENCY}. Бонусный режим действует до отмены: следующий спин снова оплачивает покупку по показанной цене.</p>
  <div className="original-confirm-actions"><button type="button" onClick={onCancel} autoFocus>НЕТ</button><button type="button" onClick={onConfirm}>ДА</button></div>
 </OriginalDialog>;
}

export function OriginalBonusShop({game,offers,stake,balance,onCancel,onChoose,onStakeChange,limits}){
 const copy={hunt:{name:'BONUSHUNT FEATURESPINS',text:'Повышенный шанс запуска бонусной игры в каждом вращении.',image:'mod_bonus'},rainbow:{name:'RAINBOW FEATURESPINS',text:'Радуга гарантированно появляется в каждом вращении.',image:'rainbow'},luck:{name:'LUCK OF THE BANDIT',text:'8 бесплатных вращений. Золотые клетки сохраняются до активации радуги.',image:'luck_of_the_bandit'},gold:{name:'ALL THAT GLITTERS IS GOLD',text:'12 бесплатных вращений. Золотые клетки сохраняются после каждой активации.',image:'all_is_gold_that_glitters'}};
 return <OriginalDialog game={game} onClose={onCancel} label="Покупка бонусов"><h2>ПОКУПКА БОНУСОВ</h2><div className="original-bonus-shop-stake">СТАВКА<strong>{money(stake)} <small>{CURRENCY}</small></strong>{onStakeChange&&<div><button type="button" aria-label="Уменьшить ставку бонуса" disabled={stake<=limits.min} onClick={()=>onStakeChange(String(adjustedStake(stake-limits.step,1,Infinity,limits)))}>−</button><button type="button" aria-label="Увеличить ставку бонуса" disabled={stake>=limits.max} onClick={()=>onStakeChange(String(adjustedStake(stake+limits.step,1,Infinity,limits)))}>+</button></div>}</div>
  <div className="original-bonus-shop">{offers.map(offer=>{const c=copy[offer.id],cost=stake*offer.multiplier;return <article className="original-bonus-card" key={offer.id} data-feature={!!offer.feature}><h3>{c.name}</h3><p>{c.text}</p><img src={base+'original-slots-v54/bandit-'+c.image+'.webp'} alt=""/><strong>{money(cost)} <small>{CURRENCY}</small></strong><button type="button" disabled={balance<cost} onClick={()=>onChoose(offer)}>{offer.feature?'ВКЛЮЧИТЬ':'КУПИТЬ'}</button></article>;})}</div>
 </OriginalDialog>;
}

export function OriginalSlotInfo({game,opened,onClose,atlas,limits}){
 const [page,setPage]=useState(0),sweet=game==='slots',house=game==='maskhouse';
 const rules=sweet?BONANZA_DEMO_RULES:MASK_SLOT_RULES[game];
 const heading=['ТАБЛИЦА ВЫПЛАТ',house?'БЕСПЛАТНЫЕ ВРАЩЕНИЯ':'БОНУСНЫЕ ФУНКЦИИ','ПРАВИЛА ИГРЫ'];
 return <OriginalDialog game={game} opened={opened} onClose={onClose} label="Таблица выплат и правила"><h2>{heading[page]}</h2><div className="original-info-content">
  {page===0?<div className="original-paytable">{Object.entries(rules.pays).map(([kind,tiers])=><article key={kind}><OriginalSymbol atlas={atlas} kind={kind}/><dl>{tiers.map((value,i)=><div key={i}><dt>{sweet?['8–9','10–11','12+'][i]:house?i+3:['5–6','7–9','10–14','15+'][i]}</dt><dd>×{money(value/100)}</dd></div>)}</dl></article>)}</div>:page===1?<div className="original-info-paragraphs">
   {sweet?<><h3>10 БЕСПЛАТНЫХ ВРАЩЕНИЙ</h3><p>4 и больше леденцов Scatter запускают 10 бесплатных вращений. В бонусе 3 и больше Scatter добавляют ещё 5 вращений.</p><h3>МНОЖИТЕЛИ</h3><p>Множители суммируются за вращение и увеличивают выплату обычных символов. Отображается фактически выпавшее значение.</p><h3>КАСКАДЫ</h3><p>8 одинаковых символов в любом месте поля дают выплату. Выигравшие символы исчезают, новые падают сверху. Каскады продолжаются, пока есть выигрыши.</p></>:house?<><h3>STICKY WILD</h3><p>Wild появляются на барабанах 2, 3 и 4. Каждый имеет множитель ×2 или ×3 и заменяет обычные символы. Во время бесплатных вращений Wild остаются на своих местах.</p><h3>9–27 ВРАЩЕНИЙ</h3><p>По одному Scatter на барабанах 1, 3 и 5 открывают девять плиток. На каждой — от 1 до 3 вращений. Их сумма определяет число бесплатных вращений. Во время бонуса повторных запусков нет.</p></>:<><h3>LUCK OF THE BANDIT</h3><p>3 FS дают 8 бесплатных вращений. Золотые клетки сохраняются между вращениями до активации радуги.</p><h3>ALL THAT GLITTERS IS GOLD</h3><p>4 FS дают 12 вращений. Золотые клетки сохраняются в течение всего бонуса, включая повторные активации.</p><h3>TREASURE AT THE END OF THE RAINBOW</h3><p>5 FS дают 12 вращений с постоянным золотым полем и радугой на каждом вращении. Этот бонус выпадает в игре и не продаётся.</p><h3>МОНЕТЫ, КЛЕВЕР И ГОРШКИ</h3><p>Радуга раскрывает награды в золотых клетках. Клевер умножает соседние награды. Горшок собирает значения остальных монет и горшков, затем запускает новое раскрытие.</p></>}
  </div>:<div className="original-info-paragraphs"><h3>{house?'20 ЛИНИЙ':sweet?'ПОЛЕ 6 × 5':'ГРУППЫ ОТ 5 СИМВОЛОВ'}</h3><p>{house?'Комбинации оплачиваются слева направо от трёх одинаковых символов.':sweet?'Совпадения считаются по всему полю, независимо от соседства.':'Группа состоит из символов, соприкасающихся сторонами. При каскаде исчезают все символы выигравшего типа, а выигравшие позиции становятся золотыми.'}</p><h3>УПРАВЛЕНИЕ</h3><p>Кнопки − и + меняют ставку. Нажмите на сумму ставки, чтобы выбрать её. Скорость переключается между обычной, быстрой и турбо и применяется к следующему вращению. Автоигра продолжается до нажатия «Стоп» или нехватки баланса.</p><p>Ставка: {limits.min}–{limits.max} {CURRENCY}. Шаг: {limits.step}. Открытые цены и собственная математика MASQ указаны в «Правилах шансов». Целевой RTP huEVO — {HUEVO_RTP}%; это оценка по проверке, а не гарантия результата отдельного раунда.</p></div>}
 </div><nav className="original-info-pages" aria-label="Страницы правил"><button type="button" disabled={page===0} aria-label="Предыдущая страница" onClick={()=>setPage(p=>p-1)}>‹</button><span>{page+1} / 3</span><button type="button" disabled={page===2} aria-label="Следующая страница" onClick={()=>setPage(p=>p+1)}>›</button></nav></OriginalDialog>;
}
