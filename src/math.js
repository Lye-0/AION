/* AION — minimal column-major scene math. No runtime dependencies. */
'use strict';
window.AION = window.AION || {};
(() => {
 const A = window.AION, TAU = Math.PI * 2;
 const vec = (x=0,y=0,z=0) => [x,y,z];
 const add = (a,b)=>a.map((v,i)=>v+b[i]);
 const sub = (a,b)=>a.map((v,i)=>v-b[i]);
 const mul = (a,s)=>a.map(v=>v*s);
 const dot = (a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const cross = (a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const norm = a=>mul(a,1/(Math.hypot(...a)||1));
 const mix = (a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
 const identity = ()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 function mm(a,b,out=new Float32Array(16)) {
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return out;
 }
 function compose(p=[0,0,0],r=[0,0,0],s=[1,1,1]) {
  const [x,y,z]=r,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  const m=identity();
  m[0]=cy*cz*s[0];m[1]=(sx*sy*cz+cx*sz)*s[0];m[2]=(-cx*sy*cz+sx*sz)*s[0];
  m[4]=-cy*sz*s[1];m[5]=(-sx*sy*sz+cx*cz)*s[1];m[6]=(cx*sy*sz+sx*cz)*s[1];
  m[8]=sy*s[2];m[9]=-sx*cy*s[2];m[10]=cx*cy*s[2];
  m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;
 }
 function lookAt(eye,target,up=[0,1,0]) {
  const z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x),m=identity();
  m[0]=x[0];m[4]=x[1];m[8]=x[2];m[1]=y[0];m[5]=y[1];m[9]=y[2];m[2]=z[0];m[6]=z[1];m[10]=z[2];
  m[12]=-dot(x,eye);m[13]=-dot(y,eye);m[14]=-dot(z,eye);return m;
 }
 function perspective(fov,aspect,near,far) {
  const m=new Float32Array(16),f=1/Math.tan(fov/2);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m;
 }
 function ortho(l,r,b,t,n,f) {
  const m=identity();m[0]=2/(r-l);m[5]=2/(t-b);m[10]=-2/(f-n);m[12]=-(r+l)/(r-l);m[13]=-(t+b)/(t-b);m[14]=-(f+n)/(f-n);return m;
 }
 function seeded(seed) {let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
 class Node {
  constructor(p=[0,0,0],r=[0,0,0],s=[1,1,1]) {this.position=p;this.rotation=r;this.scale=s;this.local=compose(p,r,s);this.world=identity();this.children=[];this.dirty=true;this.visible=true;this.tier=0;}
  add(node) {this.children.push(node);return node;}
  refresh() {this.local=compose(this.position,this.rotation,this.scale);this.dirty=true;}
  update(parent,changed=false) {const dirty=changed||this.dirty;if(dirty){if(parent)mm(parent,this.local,this.world);else this.world.set(this.local);this.dirty=false;}for(const c of this.children)c.update(this.world,dirty);}
 }
 A.M={TAU,vec,add,sub,mul,dot,cross,norm,mix,clamp,identity,mm,compose,lookAt,perspective,ortho,seeded};A.Node=Node;
})();
