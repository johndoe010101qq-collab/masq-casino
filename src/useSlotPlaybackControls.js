import {useEffect,useMemo,useRef,useState} from 'react';
import {createSlotPlaybackController} from './slot-playback-controller.js';

// requestSpin({mode:'paid',featureMode:null,speed}) must synchronously return true
// only after HallSession accepted a round. getBusy reads session.getSnapshot().busy.
export function useSlotPlaybackControls(options) {
  const latest=useRef(options);latest.current=options;
  const mounted=useRef(false);
  const [state,setState]=useState({active:false,remaining:0,accepted:0,speed:1,status:'idle',pauseReason:null});
  const controller=useMemo(()=>createSlotPlaybackController({
    requestSpin:settings=>latest.current.requestSpin(settings),
    getConditions:()=>{const o=latest.current;return {...o,busy:o.getBusy?o.getBusy():o.busy,canAfford:o.getCanAfford?o.getCanAfford():o.canAfford,hidden:typeof document!=='undefined'&&document.hidden};},
    onChange:next=>{if(mounted.current)setState(next);}
  }),[]);
  useEffect(()=>{
    mounted.current=true;controller.enable();setState(controller.snapshot());
    const visible=()=>controller.sync();document.addEventListener('visibilitychange',visible);
    return()=>{mounted.current=false;controller.disable();document.removeEventListener('visibilitychange',visible);};
  },[controller]);
  useEffect(()=>{controller.sync();},[controller,options.busy,options.ready,options.modalOpen,options.payoutOpen,options.blocked,options.normalOnly,options.canAfford]);
  // Updating the shared default affects future launches. A room pins each
  // accepted round's timeline separately, so its current animation keeps pace.
  useEffect(()=>{if([1,1.5,2].includes(options.defaultSpeed))controller.setSpeed(options.defaultSpeed);},[controller,options.defaultSpeed]);
  return {...state,startAutoplay:count=>controller.start(count),stopAutoplay:()=>controller.stop(),
    setSpeed:value=>controller.setSpeed(value)};
}
