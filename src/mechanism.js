/* One exhibition-time drive for the whole machine.
 * Contacts and visible transmissions form a connected graph. This is deliberately
 * a visual kinematic model, not a simulation of forces, escapement or timekeeping.
 */
'use strict';
(() => {
 const A=window.AION,TAU=Math.PI*2;
 class Mechanism {
  constructor({frequency=.37,amplitude=.115,phase=.4}={}){
   this.parts=[];this.links=[];this.byId=new Map();this.frequency=frequency;
   this.amplitude=amplitude;this.phase=phase;this.root='pendulum';this.solved=false;
  }
  add(id,kind,node,options={}){
   if(this.byId.has(id))throw new Error('Duplicate mechanism part: '+id);
   const part={id,kind,node,mode:'rotation',phase:node?.rotation?.[2]||0,...options};
   this.parts.push(part);this.byId.set(id,part);if(node)node.mechanismId=id;return part;
  }
  connect(from,to,kind,ratio=1,details={}){
   if(!this.byId.has(from)||!this.byId.has(to)||from===to)throw new Error('Invalid connection: '+from+' → '+to);
   if(!Number.isFinite(ratio)||ratio===0)throw new Error('Invalid drive ratio: '+from+' → '+to);
   const link={from,to,kind,ratio,...details};this.links.push(link);return link;
  }
  solve(){
   const root=this.byId.get(this.root);if(!root)throw new Error('Missing pendulum drive.');
   const adj=new Map(this.parts.map(p=>[p.id,[]]));
   for(const l of this.links){adj.get(l.from).push([l.to,l.ratio]);adj.get(l.to).push([l.from,1/l.ratio]);}
   root.speed=this.frequency;const queue=[root],seen=new Set([root.id]);
   for(let i=0;i<queue.length;i++)for(const [id,ratio]of adj.get(queue[i].id)){
    const p=this.byId.get(id),speed=queue[i].speed*ratio;
    if(seen.has(id)){
     if(Math.abs(p.speed-speed)>1e-7)throw new Error('Conflicting drive path: '+id);
    }else{p.speed=speed;seen.add(id);queue.push(p);}
   }
   const missing=this.parts.filter(p=>!seen.has(p.id));
   if(missing.length)throw new Error('Unconnected mechanism: '+missing.map(p=>p.id).join(', '));
   for(const p of this.parts)if(p.binding){p.binding.speed=p.speed;p.binding.phase=p.phase;}
   this.solved=true;this.connectedCount=seen.size;return this;
  }
  sample(t){
   if(!Number.isFinite(t))throw new RangeError('Invalid exhibition time.');
   const phase=t*this.frequency+this.phase;
   // The train moves continuously, but gently surges at each pendulum reversal.
   // The derivative remains positive, so no wheel reverses spuriously.
   const driveTime=t-.68*(Math.sin(2*phase)-Math.sin(2*this.phase))/(2*this.frequency);
   return {time:t,driveTime,pendulumAngle:Math.sin(phase)*this.amplitude,
    phase,release:.5-.5*Math.cos(2*phase)};
  }
  summary(){
   const count=kind=>this.parts.filter(p=>p.kind===kind).length;
   return {parts:this.parts.length,connected:this.connectedCount||0,links:this.links.length,
    gears:count('gear'),shafts:count('shaft'),rings:count('ring'),hands:count('hand'),
    meshContacts:this.links.filter(l=>l.kind==='mesh').length,
    root:this.root,components:this.solved?1:0};
  }
 }
 A.Mechanism=Mechanism;
})();
