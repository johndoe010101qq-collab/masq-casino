import {BlackjackPresentation} from './blackjack-presentation.js';
// The ordinary presentation clock remains synchronous. Only authoritative
// card transitions wait for the server; no shoe or hidden card reaches JS.
export class RemoteBlackjackPresentation extends BlackjackPresentation {
  pending=false;
  afterPlayer(){this.playerShown=this.hand.player.length;this.dealerShown=this.hand.dealer.length;
    if(this.hand.phase==='dealer'){this.shownReveal=true;this.runDealer();this.next();}
    else if(this.hand.phase==='resolved')this.resolve();else super.afterPlayer();}
  snapshot(){const s=super.snapshot();return {...s,canAct:s.canAct&&!this.pending};}
  move(action,after){
    if(this.pending||this.closed)return false;this.pending=true;this.status='connecting';this.publish();
    this.transition(action,this.hand).then(hand=>{this.hand=hand;this.pending=false;after();this.next();})
      .catch(error=>{this.pending=false;this.status='connection-error';this.retry=()=>this.move(action,after);this.onError?.(error);this.publish();});return true;
  }
  hit(){if(!this.snapshot().canAct)return false;return this.move('hit',()=>{this.status='hitting';this.addCard('player',this.hand.player.length-1,()=>this.afterPlayer());});}
  stand(){if(!this.snapshot().canAct)return false;return this.move('stand',()=>this.beginReveal());}
  beginReveal(){this.status='revealing';this.enqueue({kind:'flip',duration:this.timing.revealMs,complete:()=>{this.shownReveal=true;this.move('reveal',()=>this.runDealer());}});}
  runDealer(){if(this.hand.phase==='resolved'){this.status='resolving';this.enqueue({kind:'result',duration:600,complete:()=>this.resolve()});return;}
    this.move('dealer',()=>{this.status='dealer';this.addCard('dealer',this.hand.dealer.length-1,()=>this.runDealer());});}
  finish(){if(this.closed||this.pending)return false;return this.move('finish',()=>this.resolve());}
}
