'use strict';
(() => {
 const A=window.AION,{sub,norm,cross,mix,clamp,lookAt,perspective,mm}=A.M;
 const VIEWS=[
  {eye:[88,42,134],target:[-8,11,-22],fov:43,name:'全景',en:'THE CONTINUUM'},
  {eye:[139,31,-12],target:[8,14,-102],fov:55,name:'機構の深部',en:'THE TRANSMISSION'},
  {eye:[93,25,100],target:[-23,16,-18],fov:53,name:'大振り子',en:'THE OSCILLATOR'}
 ];
 class CameraControls {
  constructor(canvas,onInteract=()=>{}){
   this.canvas=canvas;this.onInteract=onInteract;this.view=0;this.target=[...VIEWS[0].target];this.eye=[...VIEWS[0].eye];this.fov=43;this.drift=true;this.dragging=false;this.pointers=new Map();this.handlers=[];this.tween=null;this.width=0;this.height=0;
   this.on(canvas,'pointerdown',e=>this.down(e));this.on(canvas,'pointermove',e=>this.move(e));this.on(canvas,'pointerup',e=>this.up(e));this.on(canvas,'pointercancel',e=>this.up(e));this.on(canvas,'lostpointercapture',e=>this.up(e));
   this.on(canvas,'wheel',e=>{e.preventDefault();this.cancelDrift();this.distance=clamp(this.distance*Math.exp(clamp(e.deltaY,-150,150)*.0014),23,440);},{passive:false});this.on(canvas,'contextmenu',e=>e.preventDefault());
   this.setPreset(0,true);
  }
  on(el,type,fn,opts){el.addEventListener(type,fn,opts);this.handlers.push(()=>el.removeEventListener(type,fn,opts));}
  spherical(){const p=sub(this.eye,this.target);this.distance=Math.hypot(...p);this.yaw=Math.atan2(p[0],p[2]);this.pitch=Math.asin(clamp(p[1]/this.distance,-1,1));}
  presetPosition(i){
   const v=VIEWS[i],aspect=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight);
   if(aspect<.8){
    const t=i===0?[14,19,-20]:[...v.target],factor=i===0?1.17:1.40,p=sub(v.eye,v.target);
    return {eye:t.map((x,j)=>x+p[j]*factor),target:t,fov:i===0?57:56};
   }
   return {eye:[...v.eye],target:[...v.target],fov:v.fov};
  }
  setPreset(i,immediate=false){
   this.view=clamp(i,0,2);const dest=this.presetPosition(this.view);
   if(immediate){this.eye=dest.eye;this.target=dest.target;this.fov=dest.fov;this.spherical();this.tween=null;}
   else this.tween={fromEye:[...this.eye],fromTarget:[...this.target],fromFov:this.fov,to:dest,elapsed:0};
  }
  cancelDrift(){this.tween=null;this.spherical();if(this.drift){this.drift=false;this.onInteract();}}
  down(e){
   if(e.button!==0&&e.button!==2&&e.pointerType==='mouse')return;
   this.canvas.setPointerCapture(e.pointerId);this.cancelDrift();this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,button:e.button});this.dragging=true;this.canvas.classList.add('is-dragging');
  }
  move(e){
   const old=this.pointers.get(e.pointerId);if(!old)return;
   const next={x:e.clientX,y:e.clientY,button:old.button};
   if(this.pointers.size===2){
    const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)[1];
    const d0=Math.hypot(old.x-other.x,old.y-other.y),d1=Math.hypot(next.x-other.x,next.y-other.y);
    if(d0>1&&d1>1)this.distance=clamp(this.distance*d0/d1,23,440);
    this.pan((next.x-old.x)*.5,(next.y-old.y)*.5);
   }else if(old.button===2||e.shiftKey)this.pan(next.x-old.x,next.y-old.y);
   else{this.yaw-=(next.x-old.x)*.005;this.pitch=clamp(this.pitch+(next.y-old.y)*.004,-1.15,1.25);}
   this.pointers.set(e.pointerId,next);
  }
  pan(dx,dy){
   const forward=norm(sub(this.target,this.eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward),scale=this.distance*.0012;
   this.target=this.target.map((v,i)=>v+(-right[i]*dx+up[i]*dy)*scale);
   this.target=this.target.map(v=>clamp(v,-230,230));
  }
  up(e){this.pointers.delete(e.pointerId);this.dragging=this.pointers.size>0;if(!this.dragging)this.canvas.classList.remove('is-dragging');}
  update(dt,time){
   const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
   if(this.width&&((this.width/this.height<.8)!==(w/h<.8))&&!this.dragging)this.setPreset(this.view);
   this.width=w;this.height=h;
   if(this.tween){
    this.tween.elapsed+=dt;let t=clamp(this.tween.elapsed/2.9,0,1);t=t*t*t*(t*(t*6-15)+10);const tr=this.tween;
    this.eye=mix(tr.fromEye,tr.to.eye,t);this.target=mix(tr.fromTarget,tr.to.target,t);this.fov=tr.fromFov+(tr.to.fov-tr.fromFov)*t;this.spherical();if(tr.elapsed>=2.9)this.tween=null;
   }else{
    const drift=this.drift?Math.sin(time*.064)*.025:0,pitch=this.pitch+(this.drift?Math.sin(time*.041)*.009:0),yaw=this.yaw+drift;
    this.eye=[this.target[0]+Math.sin(yaw)*Math.cos(pitch)*this.distance,this.target[1]+Math.sin(pitch)*this.distance,this.target[2]+Math.cos(yaw)*Math.cos(pitch)*this.distance];
   }
   this.vp=mm(perspective(this.fov*Math.PI/180,w/Math.max(1,h),.5,1100),lookAt(this.eye,this.target));
   return this;
  }
  dispose(){this.handlers.forEach(fn=>fn());}
 }
 A.CameraControls=CameraControls;A.VIEWS=VIEWS;
})();
