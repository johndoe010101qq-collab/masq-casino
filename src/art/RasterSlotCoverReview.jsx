import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import BonanzaSlot from '../BonanzaSlot.jsx';
import MaskSlotRoom from '../MaskSlotRoom.jsx';
import '../MinecraftInterface.css';
import './RasterSlotCoverReview.css';

// This route photographs the shipped room components in their real idle state.
// It is an art fixture: there is no RNG, wallet, fabricated win, or play action.
const snapshot=Object.freeze({balance:1000,busy:false,result:null,presentation:Object.freeze({speed:1}),stakeLimits:Object.freeze({})});
const session=Object.freeze({getSnapshot:()=>snapshot,begin:()=>{throw new Error('The artwork review cannot start a round.');},complete:()=>false});
const titles={slots:'Bonanza',maskhouse:'Mask Hou$e',lecipher:'LeXof'};
function Review(){
 const requested=new URLSearchParams(location.search).get('game'),[game,setGame]=useState(Object.hasOwn(titles,requested)?requested:'slots');
 return <main className="indictus-app app-shell36 raster-slot-review" data-review-game={game}>
  <nav className="raster-review-toolbar" aria-label="Обложки слотов">{Object.entries(titles).map(([value,title])=><button type="button" key={value} aria-pressed={game===value} onClick={()=>setGame(value)}>{title}</button>)}<span>Настоящее поле · исходные изображения</span></nav>
  <div id="raster-slot-review-stage" key={game}>{game==='slots'?<BonanzaSlot session={session} snapshot={snapshot} payoutOpen={false} artPreview/>:<MaskSlotRoom game={game} session={session} snapshot={snapshot} payoutOpen={false}/>}</div>
 </main>;
}
createRoot(document.getElementById('root')).render(<Review/>);
