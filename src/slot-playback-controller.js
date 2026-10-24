// UI scheduling only. No RNG, outcome generation, ledger or financial APIs.
export const SLOT_AUTO_COUNTS=Object.freeze([10,25,50]);
export const SLOT_AUTO_BALANCE='balance';
export const SLOT_PLAYBACK_SPEEDS=Object.freeze([1,1.5,2,4]);
export function createSlotPlaybackController({requestSpin,getConditions=()=>({}),onChange=()=>{},
  schedule=(callback,delay)=>setTimeout(callback,delay),cancel=id=>clearTimeout(id),gapMs=600,allowAsync=false}={}) {
  if(typeof requestSpin!=='function')throw new TypeError('A synchronous accepted-spin callback is required.');
  if(!Number.isFinite(gapMs)||gapMs<0||gapMs>10000)throw new RangeError('Invalid playback gap.');
  let enabled=true,active=false,remaining=0,accepted=0,speed=1,status='idle',pauseReason=null;
  let generation=0,timer=null,waitingRound=false,sawBusy=false;
  const snapshot=()=>Object.freeze({active,remaining,accepted,speed,status,pauseReason});
  const emit=()=>onChange(snapshot());
  function clearScheduled(){if(timer!==null){cancel(timer);timer=null;}}
  function stop(reason='stopped'){generation++;clearScheduled();active=false;remaining=0;waitingRound=false;sawBusy=false;pauseReason=null;status=reason;emit();}
  function conditions(){const c=getConditions()||{};return {busy:!!c.busy,hidden:!!c.hidden,modalOpen:!!c.modalOpen,payoutOpen:!!c.payoutOpen,blocked:!!c.blocked,ready:c.ready!==false,normalOnly:c.normalOnly!==false,canAfford:c.canAfford!==false};}
  function blockReason(c){return c.hidden?'hidden':c.modalOpen?'modal':c.payoutOpen?'payout':c.busy?'busy':!c.ready?'loading':!c.normalOnly?'feature':c.blocked?'blocked':null;}
  function sync(){
    if(!enabled||!active)return;
    const c=conditions();
    if(waitingRound){
      if(c.busy){sawBusy=true;status='waiting';pauseReason=null;clearScheduled();emit();return;}
      // An accepted round must be observed busy before any later launch. A
      // synchronous session.getSnapshot getter makes this immediate on accept.
      if(!sawBusy){status='waiting';clearScheduled();emit();return;}
      waitingRound=false;sawBusy=false;
      if(remaining===0){stop('complete');return;}
    }
    const blocked=blockReason(c);
    if(blocked){status='paused';pauseReason=blocked;clearScheduled();emit();return;}
    if(!c.canAfford){stop('unavailable');return;}
    if(remaining===0){stop('complete');return;}
    status='running';pauseReason=null;
    if(timer===null){const token=generation;timer=schedule(()=>{
      timer=null;if(!enabled||!active||token!==generation)return;
      const current=conditions();
      if(blockReason(current)){sync();return;}
      if(!current.canAfford){stop('unavailable');return;}
      let result;
      try{result=requestSpin(Object.freeze({mode:'paid',featureMode:null,speed}));}
      catch{stop('launch-error');return;}
      if(allowAsync&&result&&typeof result.then==='function'){
        status='waiting';pauseReason=null;emit();
        result.then(value=>acceptedResult(value,token)).catch(()=>{if(token===generation)stop('launch-error');});return;
      }
      acceptedResult(result,token);
    },gapMs/speed);}
    emit();
  }
  function acceptedResult(result,token){
      if(token!==generation||!enabled||!active)return;
      // Promises/objects/undefined are never treated as accepted rounds.
      if(result!==true){stop('launch-rejected');return;}
      if(remaining!==null)remaining--;accepted++;
      // Reduced-motion playback and presentation-failure fallback can settle
      // synchronously inside requestSpin. A true return still counts once;
      // no active Hall round afterward means it is already complete.
      sawBusy=conditions().busy;waitingRound=sawBusy;
      status=waitingRound?'waiting':'running';pauseReason=null;emit();
      if(!waitingRound)sync();
  }
  function start(count=SLOT_AUTO_BALANCE){if(count!==SLOT_AUTO_BALANCE&&!SLOT_AUTO_COUNTS.includes(count))throw new RangeError('Choose 10, 25, 50 or balance automatic spins.');if(!enabled)return false;generation++;clearScheduled();active=true;remaining=count===SLOT_AUTO_BALANCE?null:count;accepted=0;waitingRound=false;sawBusy=false;status='running';pauseReason=null;sync();return true;}
  function setSpeed(next){if(!SLOT_PLAYBACK_SPEEDS.includes(next))throw new RangeError('Unsupported visual speed.');speed=next;clearScheduled();if(active)sync();else emit();}
  function disable(){enabled=false;stop('unmounted');}
  function enable(){enabled=true;}
  return Object.freeze({snapshot,start,stop,sync,setSpeed,disable,enable});
}
