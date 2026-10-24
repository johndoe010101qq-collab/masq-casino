import {blackjackScore} from '../blackjack.js';
export class HuevoSession {
  remote=true; active=new Map(); listeners=new Set(); requesting=false; wallet; snapshot; request; resumedHand; handCommands=new Map(); hostPaused=false; walletOpen=false;
  constructor(initial,request){this.request=request;this.wallet=initial.wallet;this.resumedHand=initial.activeBlackjack;
    this.snapshot={...initial.config,balance:initial.wallet.balanceCents/100,busy:false,activeCount:0,pendingGame:null,result:null,history:[],currency:'монэток',mode:initial.mode};}
  subscribe=fn=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
  getSnapshot=()=>this.snapshot;
  get balanceCents(){return Math.round(this.snapshot.balance*100);}
  publish(patch={}){const pending=[...this.active.values()],held=pending.reduce((n,r)=>n+(r.payoutCents||0),0);
    this.snapshot={...this.snapshot,...patch,balance:(this.wallet.balanceCents-held)/100,busy:this.requesting||!!pending.length,activeCount:pending.length,pendingGame:pending[0]?.game||null,hostPaused:this.hostPaused,walletOpen:this.walletOpen};for(const l of this.listeners)l();}
  setHostPaused(value){this.hostPaused=!!value;this.publish();}
  setWalletOpen(value){this.walletOpen=!!value;this.publish();}
  syncWallet(w){if(w&&w.revision>=this.wallet.revision)this.wallet=w;this.publish();}
  canBegin(game){return !this.hostPaused&&!this.walletOpen&&!this.requesting&&(!this.active.size||game==='plinko'&&this.snapshot.pendingGame==='plinko');}
  async command(path,body){try{return await this.request(path,body);}catch(error){const known=await this.request('/operations/'+body.id).catch(()=>null);if(known)return known;throw error;}}
  async begin(game,choice,stake,options={}){
    if(!this.canBegin(game))return null;this.requesting=true;this.publish({result:null});
    const id=crypto.randomUUID();try{const r=await this.command('/rounds',{id,game,choice,stake,options});this.active.set(r.round.id,r.round);this.syncWallet(r.wallet);return r.round;}
    finally{this.requesting=false;this.publish();}
  }
  complete(id){const r=this.active.get(id);if(!r)return false;this.active.delete(id);const result={...r,balance:(this.wallet.balanceCents-[...this.active.values()].reduce((n,r)=>n+(r.payoutCents||0),0))/100,timestamp:Date.now()};this.publish({result,history:[result,...this.snapshot.history].slice(0,20)});return true;}
  completeStored(r){return this.complete(r?.id);}
  completeAll(game){let n=0;for(const r of this.active.values())if(!game||r.game===game)n+=Number(this.complete(r.id));return n;}
  async beginBlackjack(stake){
    if(!this.canBegin('blackjack'))return null;
    if(this.resumedHand){const r=this.resumedHand;this.resumedHand=null;this.active.set(r.id,r);this.publish();return r;}
    this.requesting=true;this.publish({result:null});try{const r=await this.command('/blackjack',{id:crypto.randomUUID(),action:'begin',stake});this.active.set(r.round.id,r.round);this.syncWallet(r.wallet);return r.round;}finally{this.requesting=false;this.publish();}
  }
  async advanceBlackjack(id,action,handle){
    const current=this.active.get(id);if(!current||handle!==current.hand)throw new Error('Раздача уже изменилась.');
    const key=id+':'+handle.version+':'+action,body=this.handCommands.get(key)||{id:crypto.randomUUID(),action,roundId:id,version:handle.version};this.handCommands.set(key,body);
    const r=await this.command('/blackjack',body);this.handCommands.delete(key);this.active.set(id,r.round);this.syncWallet(r.wallet);return r.round.hand;
  }
  blackjackView(id,handle,{playerShown=handle.player.length,dealerShown=handle.dealer.length,revealed=handle.revealed,settled=false}={}){
    const player=handle.player.slice(0,playerShown),dealer=handle.dealer.slice(0,dealerShown).map((c,i)=>i===1&&!revealed?{hidden:true}:c),shown=dealer.filter(c=>!c.hidden);
    return {player,dealer,playerTotal:player.length?blackjackScore(player).total:null,dealerTotal:shown.length?blackjackScore(shown).total:null,revealed,result:settled?handle.result:null};
  }
  completeBlackjack(id,hand){const r=this.active.get(id);if(!r||r.hand!==hand||hand.phase!=='resolved')return false;return this.complete(id);}
  reset(){return false;}
}
