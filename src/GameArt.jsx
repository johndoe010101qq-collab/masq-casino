import React,{Component,useEffect,useLayoutEffect,useMemo} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {createSlotModel} from './art/createSlotModels.js';
import {CoinScene,DiceScene,UpgradeScene} from './games/CoinDiceUpgrade.jsx';
import {PlinkoScene,RouletteScene} from './games/PlinkoRoulette.jsx';
import {GAME_META} from './game-meta.js';

const SCENES={coinflip:CoinScene,dice:DiceScene,plinko:PlinkoScene,roulette:RouletteScene,upgrader:UpgradeScene};
// Projected bounds include the entire toss, tray, board and wheel rim.
const BOUNDS={coinflip:[3.5,3.8],dice:[3.8,3.4],plinko:[6.2,4.6],roulette:[6.2,4.3],upgrader:[3.4,3.6]};
class RenderBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div className="render-fallback" role="status">3D недоступно в этом браузере</div>:this.props.children;}
}
function FitCamera({game,prop,thumbnail}){
  const {camera,size,invalidate}=useThree();
  useLayoutEffect(()=>{
    const [width,height]=prop?[3.6,3.6]:BOUNDS[game];
    camera.zoom=Math.max(1,Math.min(thumbnail?70:110,size.width/width,size.height/height));
    camera.lookAt(0,.1,0);
    camera.updateProjectionMatrix();
    invalidate();
  },[camera,size.width,size.height,game,prop,thumbnail,invalidate]);
  return null;
}
function ModelProp({kind}){
  const mesh=useMemo(()=>createSlotModel(kind,{fit:2.8}),[kind]);
  useEffect(()=>()=>mesh.userData.dispose?.(),[mesh]);
  return <primitive object={mesh} dispose={null}/>;
}
export default function GameArt({game,round=null,elapsed=0,busy=false,choice,thumbnail=false,prop}){
  const Scene=SCENES[game];
  const position=game==='plinko'?[0,.2,8]:[4,3.2,6];
  return <RenderBoundary><Canvas orthographic camera={{position,zoom:45,near:.1,far:40}} dpr={[1,1.5]} frameloop="demand" gl={{antialias:false,powerPreference:'low-power'}} fallback={<div className="render-fallback">Включи WebGL для 3D</div>}>
    <color attach="background" args={['#11141a']}/>
    <FitCamera game={game} prop={prop} thumbnail={thumbnail}/>
    <ambientLight color="#cfdae6" intensity={1.25}/>
    <directionalLight position={[-4,7,5]} color="#fff1df" intensity={3}/>
    <directionalLight position={[5,2,-1]} color="#b5bfce" intensity={.9}/>
    {prop?<ModelProp kind={prop}/>:Scene?<Scene round={round} elapsed={elapsed} duration={GAME_META.find(row=>row.id===game).duration} busy={busy} choice={choice}/>:null}
  </Canvas></RenderBoundary>;
}
