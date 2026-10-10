const unit = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// Terminal timing never receives the ticket or win flag. Both outcomes have
// the same connection, scan and decode sequence until the reveal boundary.
export function upgradeTerminalPose(progress, hasRound = true) {
 const p=hasRound?unit(progress):0;
 return Object.freeze({ reveal:hasRound&&p>=.92,
  phase:!hasRound?'idle':p<.18?'connect':p<.72?'scan':p<.92?'decrypt':'reveal',
  packets:hasRound?Math.min(12,Math.floor(p/.92*12)):0,
  scanY:Math.sin(p*Math.PI*5)**2*1400,
  codeTick:Math.floor(p*52) });
}
const CODE='8F3A27D1C6409BE5';
export function terminalCode(tick, active=true) {
 if(!active)return '••••  ••••  ••••';
 const frame=Number.isSafeInteger(tick)&&tick>=0?tick:0;
 return Array.from({length:3},(_,group)=>Array.from({length:4},(_,index)=>CODE[(frame*3+group*5+index*7)%CODE.length]).join('')).join('  ');
}
