import {getLexofMascotPresentation} from './lexof-mascot-presentation.js';
import {getHouseMascotPresentation} from './house-mascot-presentation.js';
import {getBonanzaMascotPresentation} from './bonanza-mascot-presentation.js';

export const MINECRAFT_SLOT_PALETTE=Object.freeze({ink:'#09120f',felt:'#122821',steel:'#243830',paper:'#e4ebdc',mint:'#9dd9b9',brass:'#bca777'});
export const MINECRAFT_SLOT_LAYOUT=Object.freeze({
 desktop:Object.freeze({left:.26,right:.065,top:.205,bottom:.205}),
 mobile:Object.freeze({left:.065,right:.065,top:.315,bottom:.19})
});

// The credited-payout selectors enforce the public presentation boundary.
// Decorative sprites never own an outcome, stake or settlement clock.
export function minecraftSlotReaction(visual,game,finishedVisual=null) {
 const selected=game==='lecipher'?getLexofMascotPresentation(visual,game,finishedVisual):game==='maskhouse'?getHouseMascotPresentation(visual,game,finishedVisual):getBonanzaMascotPresentation(visual,finishedVisual);
 let pose=selected.pose||'idle',transient=!!selected.transient;
 if(game==='slots'&&['settled','spin-summary','bonus-summary'].includes(visual?.phase)&&selected.creditedPayoutCents===0){pose='loss';transient=true;}
 // Every outcome gesture ends once. Completing an older snapshot cannot
 // suppress a new spin or leave the actor dancing in an idle room.
 if(finishedVisual===visual&&['win','loss'].includes(pose)){pose='idle';transient=false;}
 return Object.freeze({pose,key:selected.reactionKey||`${visual?.phase||'idle'}:${visual?.serial||0}`,transient});
}

export function minecraftSlotPose(seconds,reaction={pose:'idle'},reducedMotion=false) {
 if(reducedMotion)return Object.freeze({bodyY:0,bodyYaw:.15,bodyRoll:0,headYaw:.08,headPitch:.04,leftArm:-.07,rightArm:.07,leftPitch:0,rightPitch:0});
 const t=Math.max(0,Number.isFinite(seconds)?seconds:0),breath=Math.sin(t*1.7),watch=reaction.pose==='watch',bonus=['bonus','rainbow'].includes(reaction.pose),win=reaction.pose==='win',loss=reaction.pose==='loss';
 return Object.freeze({
  bodyY:breath*.045+(bonus?Math.abs(Math.sin(t*4.2))*.12:0),bodyYaw:.15+Math.sin(t*.63)*.035,bodyRoll:bonus?Math.sin(t*4.2)*.09:loss?Math.sin(t*6)*.015:0,
  headYaw:watch?-.27+Math.sin(t*.7)*.055:win?Math.sin(t*1.8)*.14:.08+Math.sin(t*.55)*.055,
  headPitch:win?-.07+Math.sin(t*3)*.07:loss?.12+Math.sin(t*5)*.07:.04+breath*.018,
  leftArm:bonus?-.8-Math.sin(t*4.2)*.35:win?-.25: -.07+Math.sin(t*.9)*.025,
  rightArm:bonus?.8+Math.sin(t*4.2)*.35:win?.25:.07-Math.sin(t*.9)*.025,
  leftPitch:watch?-.15:win?-.6+Math.sin(t*3)*.1:loss?-.13:0,
  rightPitch:watch?-.28:win?-.6-Math.sin(t*3)*.1:loss?-.13:0
 });
}

export function minecraftSlotField(width,height) {
 const mobile=width/height<1.05,l=MINECRAFT_SLOT_LAYOUT[mobile?'mobile':'desktop'],worldHeight=12/(width/height);
 return Object.freeze({mobile,worldHeight,width:12*(1-l.left-l.right),height:worldHeight*(1-l.top-l.bottom),x:12*(l.left+(1-l.left-l.right)/2-.5),y:worldHeight*(.5-l.top-(1-l.top-l.bottom)/2)});
}
