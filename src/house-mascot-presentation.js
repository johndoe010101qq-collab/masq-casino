import { lexofMascotCreditedCents } from './lexof-mascot-presentation.js';

// Both slot presentations use the same credited-value convention. Nominal
// payouts, previews and past winnings never trigger the host's celebration.
export const houseMascotCreditedCents = lexofMascotCreditedCents;
const frames=Object.freeze({idle:0,watch:2,win:3,bonus:4,loss:5});
const results=new Set(['summary','spin-summary','settled','bonus-summary']);
const payments=new Set(['win','pay','payline','bonus-payment']);
const bonuses=new Set(['scatter','bonus','bonus-selection','bonus-intro','profile-gift']);
const attentive=new Set(['reel','deal','remove','cascade']);

export function getHouseMascotPresentation(visual={},game=null,finishedVisual=null) {
  const phase=typeof visual?.phase==='string'?visual.phase:'idle';
  const creditedPayoutCents=houseMascotCreditedCents(visual);
  const visible=game==='maskhouse';
  let pose='idle',transient=false;
  if(visible) {
    if(results.has(phase)){pose=creditedPayoutCents>0?'win':'loss';transient=true;}
    else if(bonuses.has(phase))pose='bonus';
    else if(payments.has(phase))pose=creditedPayoutCents>0?'win':'watch';
    else if(attentive.has(phase))pose='watch';
  }
  const reactionFinished=transient&&finishedVisual===visual;
  if(reactionFinished){pose='idle';transient=false;}
  const serial=Number.isSafeInteger(visual?.serial)?visual.serial:'terminal';
  return Object.freeze({visible,phase,pose,frame:frames[pose],creditedPayoutCents,transient,reactionFinished,
    reactionKey:`${phase}:${serial}:${pose}:${creditedPayoutCents}`});
}
