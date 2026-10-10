import {mkdirSync,writeFileSync} from 'node:fs';
import {SLOT_SYMBOL_KINDS,SLOT_MODEL_PARTS,SLOT_PALETTE} from '../src/art/createSlotModels.js';
function crc32(bytes){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
const crc=crc32;

function renderAtlas(data) {
 const S=256, SS=2, N=S*SS, width=S*4,height=S*3, atlas=new Uint8Array(width*height*4);
 const norm=a=>{const d=Math.hypot(...a);return a.map(x=>x/d);},dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const faces=[[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]];
 function points(part){const [rx,ry,rz]=part.rotation.map(d=>d*Math.PI/180),a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz);return [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>{const[x,y,z]=v.map((n,i)=>n*part.size[i]/2);return [(c*e)*x-(c*f)*y+d*z+part.at[0],(a*f+b*e*d)*x+(a*e-b*f*d)*y-b*c*z+part.at[1],(b*f-a*e*d)*x+(b*e+a*f*d)*y+a*c*z+part.at[2]];});}
 for(let index=0;index<data.kinds.length;index++){
 const kind=data.kinds[index],camera=norm(kind==='scatter'?[2,1.8,8]:kind==='laptop'?[3.8,2.8,6]:[3,2.4,7]),right=norm(cross([0,1,0],camera)),up=cross(camera,right);
 const meshes=data.parts[kind].map(part=>({part,vertices:points(part)})),all=meshes.flatMap(m=>m.vertices),lo=[0,1,2].map(i=>Math.min(...all.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...all.map(p=>p[i]))),center=lo.map((v,i)=>(v+hi[i])/2);
 const projected=all.map(p=>{const q=sub(p,center);return [dot(q,right),dot(q,up)];}),rangeX=Math.max(...projected.map(p=>p[0]))-Math.min(...projected.map(p=>p[0])),rangeY=Math.max(...projected.map(p=>p[1]))-Math.min(...projected.map(p=>p[1])),scale=N*.83/Math.max(rangeX,rangeY),pixels=new Uint8Array(N*N*4),depth=new Float32Array(N*N);depth.fill(-Infinity);
 function triangle(ps,color){const[a,b,c]=ps,area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<1e-7)return;const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(N-1,Math.ceil(Math.max(a[0],b[0],c[0]))),minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(N-1,Math.ceil(Math.max(a[1],b[1],c[1])));for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const px=x+.5,py=y+.5,w1=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,w2=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,w3=1-w1-w2;if(w1<-.000001||w2<-.000001||w3<-.000001)continue;const z=w1*a[2]+w2*b[2]+w3*c[2],i=y*N+x;if(z<=depth[i])continue;depth[i]=z;const at=i*4;pixels[at]=color[0];pixels[at+1]=color[1];pixels[at+2]=color[2];pixels[at+3]=255;}}
 const key=norm([-3,5,7]),fill=norm([4,1,2]);
 for(const mesh of meshes){const verts=mesh.vertices.map(p=>sub(p,center)),screen=verts.map(p=>[N/2+dot(p,right)*scale,N/2-dot(p,up)*scale,dot(p,camera)]),hex=data.palette[mesh.part.material].slice(1),base=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
 for(const face of faces){const normal=norm(cross(sub(verts[face[1]],verts[face[0]]),sub(verts[face[2]],verts[face[0]])));if(dot(normal,camera)<=0)continue;const light=.34+.60*Math.max(0,dot(normal,key))+.15*Math.max(0,dot(normal,fill)),color=base.map((c,i)=>Math.min(255,Math.round(c*light*(i===0?1.015:i===2?.985:1))));triangle([screen[face[0]],screen[face[1]],screen[face[2]]],color);triangle([screen[face[0]],screen[face[2]],screen[face[3]]],color);}
 }
 const ox=(index%4)*S,oy=Math.floor(index/4)*S;
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){const sums=[0,0,0];let count=0;for(let dy=0;dy<SS;dy++)for(let dx=0;dx<SS;dx++){const at=((y*SS+dy)*N+x*SS+dx)*4;if(pixels[at+3]){count++;for(let k=0;k<3;k++)sums[k]+=pixels[at+k];}}const dst=((oy+y)*width+ox+x)*4;if(count){for(let k=0;k<3;k++)atlas[dst+k]=Math.round(sums[k]/count);atlas[dst+3]=Math.round(255*count/(SS*SS));}}
 }
 const mask=new Uint8Array(S*S*4),mi=data.kinds.indexOf('scatter'),mx=(mi%4)*S,my=Math.floor(mi/4)*S;for(let y=0;y<S;y++)mask.set(atlas.subarray(((my+y)*width+mx)*4,((my+y)*width+mx+S)*4),y*S*4);
 return {width,height,pixels:atlas,maskWidth:S,maskHeight:S,mask};
}

function png(width,height,pixels){
const raw=new Uint8Array(height*(width*4+1));for(let y=0;y<height;y++){const off=y*(width*4+1);raw[off]=0;raw.set(pixels.subarray(y*width*4,(y+1)*width*4),off+1);}
const chunks=[],head=new Uint8Array([0x78,0x01]);chunks.push(head);for(let off=0;off<raw.length;off+=65535){const body=raw.subarray(off,Math.min(raw.length,off+65535)),block=new Uint8Array(5+body.length),v=new DataView(block.buffer);block[0]=off+body.length===raw.length?1:0;v.setUint16(1,body.length,true);v.setUint16(3,body.length^0xffff,true);block.set(body,5);chunks.push(block);}
let a=1,b=0;for(const v of raw){a=(a+v)%65521;b=(b+a)%65521;}const tail=new Uint8Array(4);new DataView(tail.buffer).setUint32(0,((b<<16)|a)>>>0,false);chunks.push(tail);const z=new Uint8Array(chunks.reduce((s,a)=>s+a.length,0));let p=0;for(const c of chunks){z.set(c,p);p+=c.length;}
function chunk(type,data){const out=new Uint8Array(12+data.length),v=new DataView(out.buffer);v.setUint32(0,data.length,false);for(let i=0;i<4;i++)out[i+4]=type.charCodeAt(i);out.set(data,8);v.setUint32(8+data.length,crc(out.subarray(4,8+data.length)),false);return out;}
const ihdr=new Uint8Array(13),iv=new DataView(ihdr.buffer);iv.setUint32(0,width,false);iv.setUint32(4,height,false);ihdr[8]=8;ihdr[9]=6;
const all=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("IDAT",z),chunk("IEND",new Uint8Array())],out=new Uint8Array(all.reduce((s,a)=>s+a.length,0));p=0;for(const c of all){out.set(c,p);p+=c.length;}return out;
}
const data={kinds:SLOT_SYMBOL_KINDS,parts:SLOT_MODEL_PARTS,palette:SLOT_PALETTE};
const r=renderAtlas(data);
mkdirSync(new URL('../public/',import.meta.url),{recursive:true});
writeFileSync(new URL('../public/bonanza-symbols.png',import.meta.url),png(r.width,r.height,r.pixels));
writeFileSync(new URL('../public/indictus-mask.png',import.meta.url),png(r.maskWidth,r.maskHeight,r.mask));
console.log('PNG atlas and mask rendered from authored cuboids.');
