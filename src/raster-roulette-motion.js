const unit=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
export function rasterRoulettePose(pocketIndex,progress) {
 const p=unit(progress),ease=1-(1-p)**3;
 const index=Number.isInteger(pocketIndex)&&pocketIndex>=0&&pocketIndex<37?pocketIndex:0;
 const angle=(-Math.PI*12+index*Math.PI*2/37)*ease;
 const radius=43-(1-(1-unit((p-.6)/.4))**3)*12;
 return Object.freeze({wheelDegrees:1800*ease,ballX:50+Math.sin(angle)*radius,ballY:50-Math.cos(angle)*radius});
}
