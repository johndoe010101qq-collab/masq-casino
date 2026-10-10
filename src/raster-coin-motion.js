const unit=n=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
const ease=n=>1-(1-n)**3;
export function rasterCoinPose(progress,side='heads') {
 const p=unit(progress),reveal=p>=.9;
 const turn=reveal?1710+(side==='tails'?-90:90)*ease((p-.9)/.1):1710*ease(p/.9);
 return Object.freeze({turnDegrees:turn,flight:-Math.sin(Math.PI*p)*24,tilt:Math.sin(Math.PI*p*2)*8,reveal});
}
