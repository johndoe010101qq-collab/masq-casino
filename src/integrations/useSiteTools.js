import {useEffect,useRef} from 'react';
import {flushSync} from 'react-dom';
import {GAME_META} from '../game-meta.js';

export default function useSiteTools({session,game,chanceRules,openGame,openChanceRules}){
  const current=useRef();
  current.current={session,game,chanceRules,openGame,openChanceRules};
  useEffect(()=>{
    const context=document.modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=tool=>{
      try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(error=>{if(!lifecycle.signal.aborted)console.warn('Site tool registration failed',error);});}
      catch(error){if(!lifecycle.signal.aborted)console.warn('Site tool registration failed',error);}
    };
    register({
      name:'read_demo_session',title:'Read demo session',
      description:'Read the visible demo balance and round status. Does not start a game or place a stake.',
      inputSchema:{type:'object',properties:{},additionalProperties:false},
      annotations:{readOnlyHint:true,untrustedContentHint:false},
      execute(input){
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new TypeError('Expected an empty object.');
        const {session,game,chanceRules}=current.current;
        const {balance,busy}=session.getSnapshot();
        return {mode:'demo',view:chanceRules?'chance-rules':game||'hall',balance,busy,games:GAME_META.map(({id,name})=>({id,name}))};
      }
    });
    register({
      name:'navigate_game',title:'Open a game',
      description:'Navigate to the hall or a game, using the same navigation as the visible interface. Does not start a round, debit the balance or change a stake.',
      inputSchema:{type:'object',properties:{view:{type:'string',enum:['hall','chance-rules',...GAME_META.map(({id})=>id)]}},required:['view'],additionalProperties:false},
      annotations:{readOnlyHint:false,untrustedContentHint:false},
      async execute(input){
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!['hall','chance-rules',...GAME_META.map(({id})=>id)].includes(input.view))throw new TypeError('Choose an available view.');
        if(current.current.session.getSnapshot().busy)throw new Error('Wait until the current round completes.');
        flushSync(()=>input.view==='chance-rules'?current.current.openChanceRules():current.current.openGame(input.view==='hall'?null:input.view));
        await new Promise(resolve=>requestAnimationFrame(resolve));
        return {view:current.current.chanceRules?'chance-rules':current.current.game||'hall',balance:current.current.session.getSnapshot().balance};
      }
    });
    return()=>lifecycle.abort();
  },[]);
}
