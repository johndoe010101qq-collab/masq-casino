export const PLINKO_VISUAL_LAYOUT=Object.freeze({
  scale:.72,position:Object.freeze([0,-.7504,0]),width:6.1,height:6.5,target:Object.freeze([0,.30,0]),
});
export function plinkoVisualPoint(point){
  return point.map((value,index)=>value*PLINKO_VISUAL_LAYOUT.scale+PLINKO_VISUAL_LAYOUT.position[index]);
}
