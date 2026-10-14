import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import {classicHostPresentation} from './classic-host-presentation.js';
const STEP=1/240,FLOOR=-1.1975;
let cache=null;
// One deterministic rigid-body rehearsal, sampled by the existing round clock.
// This solver never receives a ticket, value, stake, balance or payout.
export function diceRigidFrames(){
 if(cache)return cache;
 const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:false});
 world.solver.iterations=20;world.solver.tolerance=1e-7;
 const felt=new CANNON.Material('felt'),ivory=new CANNON.Material('ivory');
 world.addContactMaterial(new CANNON.ContactMaterial(felt,ivory,{friction:.55,restitution:.22,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
 const plane=new CANNON.Body({mass:0,material:felt,shape:new CANNON.Plane(),position:new CANNON.Vec3(0,FLOOR,0)});
 plane.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(plane);
 const origin=classicHostPresentation('dice',.12,true).gestureSocket;
 const body=new CANNON.Body({mass:.085,material:ivory,shape:new CANNON.Box(new CANNON.Vec3(.3306,.3306,.3306)),
  position:new CANNON.Vec3(...origin),velocity:new CANNON.Vec3(.42,1.35,3.2),angularVelocity:new CANNON.Vec3(-9.5,2.6,5.2),linearDamping:.10,angularDamping:.20});
 world.addBody(body);
 const frames=[];let firstContact=null;
 for(let tick=0;tick<=480;tick++){
  if(tick)world.step(STEP);
  if(firstContact===null&&world.contacts.length)firstContact=tick*STEP;
  frames.push(Object.freeze({time:tick*STEP,position:Object.freeze([body.position.x,body.position.y,body.position.z]),
   quaternion:Object.freeze([body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w]),
   velocity:Object.freeze([body.velocity.x,body.velocity.y,body.velocity.z]),angularSpeed:body.angularVelocity.length(),contact:world.contacts.length>0}));
 }
 cache=Object.freeze({frames:Object.freeze(frames),firstContact,step:STEP,gravity:9.81});return cache;
}
export function diceRigidPose(time){
 const {frames,step}=diceRigidFrames(),t=Math.max(0,Math.min(frames.at(-1).time,Number.isFinite(time)?time:0)),index=Math.min(frames.length-2,Math.floor(t/step));
 const a=frames[index],b=frames[index+1],weight=(t-a.time)/step;
 const position=a.position.map((v,i)=>v+(b.position[i]-v)*weight),quaternion=new THREE.Quaternion(...a.quaternion).slerp(new THREE.Quaternion(...b.quaternion),weight);
 return Object.freeze({position:Object.freeze(position),quaternion:Object.freeze(quaternion.toArray()),contact:a.contact||b.contact,time:t});
}
