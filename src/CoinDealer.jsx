import React,{useEffect,useMemo} from 'react';
import {useLoader} from '@react-three/fiber';
import * as THREE from 'three';
import {coinDealerPresentation,COIN_DEALER_STAGE} from './coin-dealer-presentation.js';

export const COIN_DEALER_SKIN='/masq-dealer-skin-v36.png';
export const COIN_DEALER_SKIN_PARTS=Object.freeze({
  head:{box:[8,8,8],uv:[0,0],outer:[32,0],rows:[0,8],top:8,inflate:1},
  body:{box:[8,12,4],uv:[16,16],outer:[16,32],rows:[0,12],top:12,inflate:.5},
  upperRight:{box:[3,12,4],uv:[40,16],outer:[40,32],rows:[0,6],top:2,inflate:.5,down:2},
  foreRight:{box:[3,12,4],uv:[40,16],outer:[40,32],rows:[6,10],top:0,inflate:.5,up:2,down:2},
  handRight:{box:[3,12,4],uv:[40,16],outer:[40,32],rows:[10,12],top:0,inflate:.5,up:2},
  upperLeft:{box:[3,12,4],uv:[32,48],outer:[48,48],rows:[0,6],top:2,inflate:.5,down:2},
  foreLeft:{box:[3,12,4],uv:[32,48],outer:[48,48],rows:[6,10],top:0,inflate:.5,up:2,down:2},
  handLeft:{box:[3,12,4],uv:[32,48],outer:[48,48],rows:[10,12],top:0,inflate:.5,up:2},
  thighRight:{box:[4,12,4],uv:[0,16],outer:[0,32],rows:[0,6],top:0,inflate:.5,down:2},
  shinRight:{box:[4,12,4],uv:[0,16],outer:[0,32],rows:[6,10],top:0,inflate:.5,up:2,down:2},
  footRight:{box:[4,12,4],uv:[0,16],outer:[0,32],rows:[10,12],top:0,inflate:.5,up:2},
  thighLeft:{box:[4,12,4],uv:[16,48],outer:[0,48],rows:[0,6],top:0,inflate:.5,down:2},
  shinLeft:{box:[4,12,4],uv:[16,48],outer:[0,48],rows:[6,10],top:0,inflate:.5,up:2,down:2},
  footLeft:{box:[4,12,4],uv:[16,48],outer:[0,48],rows:[10,12],top:0,inflate:.5,up:2},
});

// Standard 64x64 Minecraft box-face UVs, split at actual source rows. Cut
// surfaces sample the neighboring row, never a stretched entire sleeve.
export function makeCoinDealerSkinGeometry(part,outer=false,cover=null,pixel=COIN_DEALER_STAGE.pixel) {
  const spec=COIN_DEALER_SKIN_PARTS[part];
  if(!spec)throw new Error('Unknown dealer skin part: '+part);
  const [w,h,d]=spec.box,[u,v]=outer?spec.outer:spec.uv;
  let [r0,r1]=spec.rows,yTop=spec.top,inset=1;
  if(cover==='up'){r1=r0;r0=Math.max(0,r0-spec.up);yTop+=r1-r0;inset=.96;}
  if(cover==='down'){r0=r1;r1=Math.min(h,r1+spec.down);yTop-=spec.rows[1]-spec.rows[0];inset=.96;}
  const inflate=outer?spec.inflate:0;
  const extraTop=outer&&r0===0&&!cover?inflate/2:0,extraBottom=outer&&r1===h&&!cover?inflate/2:0;
  const geometry=new THREE.BoxGeometry((w+inflate)*pixel*inset,(r1-r0+extraTop+extraBottom)*pixel,(d+inflate)*pixel*inset);
  const rect=(x0,y0,x1,y1)=>[[x0/64,1-y1/64],[x1/64,1-y1/64],[x1/64,1-y0/64],[x0/64,1-y0/64]];
  const y0=v+d+r0,y1=v+d+r1;
  const top=r0>0?rect(u+d,y0,u+d+w,y0+1):rect(u+d,v,u+d+w,v+d);
  const bottom=r1<h?rect(u+d,y1-1,u+d+w,y1):rect(u+d+w,v,u+d+2*w,v+d);
  const left=rect(u,y0,u+d,y1),front=rect(u+d,y0,u+d+w,y1),right=rect(u+d+w,y0,u+2*d+w,y1),back=rect(u+2*d+w,y0,u+2*d+2*w,y1);
  const order=face=>[face[3],face[2],face[0],face[1]];
  geometry.attributes.uv.set(new Float32Array([order(right),order(left),order(top),[bottom[0],bottom[1],bottom[3],bottom[2]],order(front),order(back)].flat(2)));
  geometry.translate(0,(yTop-(r1-r0)/2+(extraTop-extraBottom)/2)*pixel,0);
  geometry.userData={part,outer,cover,rows:[r0,r1],sourceBox:[...spec.box],atlas:[u,v],pixel};
  return geometry;
}

function SkinPiece({part,skin,pixel}) {
  const spec=COIN_DEALER_SKIN_PARTS[part];
  const geometry=useMemo(()=>{
    const pieces=[];
    for(const outer of [false,true])for(const cover of [null,...(spec.up?['up']:[]),...(spec.down?['down']:[])])pieces.push(makeCoinDealerSkinGeometry(part,outer,cover,pixel));
    return pieces;
  },[part,pixel,spec]);
  useEffect(()=>()=>geometry.forEach(item=>item.dispose()),[geometry]);
  return <group name={'exact-skin-'+part}>{geometry.map((shape,index)=><mesh key={index} geometry={shape} castShadow receiveShadow>
    <meshStandardMaterial map={skin} roughness={1} metalness={0} alphaTest={.5} side={THREE.DoubleSide}/>
  </mesh>)}</group>;
}

function Arm({side,joints,skin,pixel}) {
  const suffix=side==='right'?'Right':'Left';
  return <group name={'coin-dealer-shoulder-'+side} position={joints.shoulder} quaternion={joints.upper}>
    <SkinPiece part={'upper'+suffix} skin={skin} pixel={pixel}/>
    <group name={'coin-dealer-elbow-'+side} position={joints.elbow} quaternion={joints.lower}>
      <SkinPiece part={'fore'+suffix} skin={skin} pixel={pixel}/>
      <group name={'coin-dealer-wrist-'+side} position={joints.wrist} quaternion={joints.hand}>
        <SkinPiece part={'hand'+suffix} skin={skin} pixel={pixel}/>
        <group name={'coin-socket-'+side} position={joints.socketLocal}/>
      </group>
    </group>
  </group>;
}

function Legs({skin,pixel,angle}) {
  return <>{['Right','Left'].map((suffix,index)=><group key={suffix} position={[(index?1:-1)*1.9*pixel,0,-.1*pixel]} rotation={[-angle,0,0]}>
    <SkinPiece part={'thigh'+suffix} skin={skin} pixel={pixel}/>
    <group position={[0,-6*pixel,0]} rotation={[angle,0,0]}>
      <SkinPiece part={'shin'+suffix} skin={skin} pixel={pixel}/>
      <group position={[0,-4*pixel,0]}><SkinPiece part={'foot'+suffix} skin={skin} pixel={pixel}/></group>
    </group>
  </group>)}</>;
}

export default function CoinDealer({round,progress=0,playing=false,reduced=false,presentation}) {
  const loaded=useLoader(THREE.TextureLoader,COIN_DEALER_SKIN);
  const skin=useMemo(()=>{const map=loaded.clone();map.colorSpace=THREE.SRGBColorSpace;map.magFilter=map.minFilter=THREE.NearestFilter;map.generateMipmaps=false;map.needsUpdate=true;return map;},[loaded]);
  useEffect(()=>()=>skin.dispose(),[skin]);
  const pose=presentation||coinDealerPresentation(round,progress,playing,reduced),dealer=pose.dealer,pixel=dealer.pixel;
  return <group name="whole-seated-anonymous-coin-dealer">
    <group position={[0,pose.stage.floor,pose.stage.actorZ]} name="coin-dealer-chair">
      <mesh position={[0,.3625,-.06]} castShadow receiveShadow><boxGeometry args={[.75,.15,.59]}/><meshStandardMaterial color="#25282c" roughness={.96}/></mesh>
      <mesh position={[0,.675,-.245]} castShadow receiveShadow><boxGeometry args={[.69,.50,.10]}/><meshStandardMaterial color="#25282c" roughness={.96}/></mesh>
      <mesh position={[0,.19,-.06]} castShadow><boxGeometry args={[.125,.26,.125]}/><meshStandardMaterial color="#666f72" roughness={.72} metalness={.22}/></mesh>
    </group>
    <group name="coin-dealer-hip" position={dealer.position}>
      <group name="coin-dealer-waist" quaternion={dealer.quaternion}>
        <SkinPiece part="body" skin={skin} pixel={pixel}/>
        <group name="coin-dealer-neck" position={[0,12*pixel,0]} quaternion={dealer.head}><SkinPiece part="head" skin={skin} pixel={pixel}/></group>
        <Arm side="right" joints={dealer.right} skin={skin} pixel={pixel}/>
        <Arm side="left" joints={dealer.left} skin={skin} pixel={pixel}/>
      </group>
      <Legs skin={skin} pixel={pixel} angle={dealer.legAngle}/>
    </group>
  </group>;
}
