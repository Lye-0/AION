import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=fileURLToPath(new URL('..',import.meta.url)),sb={window:{},console,Math,Float32Array,Map};
vm.createContext(sb);
for(const name of ['math','geometry','clock','transmission','mechanism','linkage','world','controls'])vm.runInContext(readFileSync(root+`src/${name}.js`,'utf8'),sb);
const A=sb.window.AION,M=A.M,w=A.createWorld(),N=w.network,TAU=Math.PI*2;
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const point=(m,p)=>[0,1,2].map(k=>m[12+k]+m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]);
const vector=(m,k)=>M.norm([m[k],m[k+1],m[k+2]]);
const sample=A.Clock.sample(new Date(2026,8,11,10,10,30,250).getTime());
function connectedFrom(rootId){const seen=new Set([rootId]);let changed=true;while(changed){changed=false;for(const l of N.links){if(seen.has(l.from)&&!seen.has(l.to)){seen.add(l.to);changed=true;}if(seen.has(l.to)&&!seen.has(l.from)){seen.add(l.from);changed=true;}}}return seen;}

test('all 80 toothed assemblies, including the original far annulus, are registered',()=>{
 const teeth=w.meshes.filter(m=>m.role==='gear-teeth'),parts=N.parts.filter(p=>p.kind==='gear');
 assert.equal(teeth.length,80);assert.equal(parts.length,80);assert.equal(w.gearCount,80);
 assert.deepEqual(new Set(teeth.map(m=>m.assemblyId)),new Set(parts.map(p=>p.id)));
});
test('every gear, shaft, ring, pendulum and hand belongs to one connected network',()=>{
 const seen=connectedFrom('pendulum');assert.equal(seen.size,N.parts.length);assert.equal(N.summary().components,1);
 for(const p of N.parts)assert.ok(seen.has(p.id),p.id);
 assert.equal(N.links.length,N.parts.length-1);
});
test('there are no independently animated orphan rotors',()=>{
 for(const r of w.rotors){assert.ok(r.part,r.node.mechanismId);assert.equal(r.part.binding,r);assert.equal(N.byId.get(r.part.id),r.part);assert.ok(Number.isFinite(r.part.speed)&&r.part.speed!==0);}
 assert.equal(w.rotors.length,N.parts.filter(p=>p.binding).length);
});
test('all rotary velocities are propagated through the actual connection graph',()=>{
 for(const l of N.links)near(N.byId.get(l.to).speed,N.byId.get(l.from).speed*l.ratio,1e-9);
});
test('every gear and transmission shaft advances under the same drive-time sample',()=>{
 w.update(9,sample);const angles=new Map(w.rotors.map(r=>[r.part.id,r.node.rotation[r.axis]])),start=w.motion.driveTime;
 w.update(10,sample);const delta=w.motion.driveTime-start;
 for(const r of w.rotors){near(r.node.rotation[r.axis]-angles.get(r.part.id),delta*r.part.speed,1e-8);assert.notEqual(r.node.rotation[r.axis],angles.get(r.part.id),r.part.id);}
});
test('every wheel freezes together, while real-time hands remain live',()=>{
 w.update(21,sample);const angles=w.rotors.map(r=>r.node.rotation[r.axis]);
 const later=A.Clock.sample(sample.timestamp+90000);w.update(21,later);
 w.rotors.forEach((r,i)=>near(r.node.rotation[r.axis],angles[i],1e-10));
 near(w.clock.minute.rotation[2],later.minuteAngle);near(w.clock.hour.rotation[2],later.hourAngle);
});
test('all 56 visible meshing pairs are coplanar and have tangent pitch circles',()=>{
 w.update(0,sample);const links=N.links.filter(l=>l.kind==='mesh');assert.equal(links.length,56);
 for(const l of links){
  const a=N.byId.get(l.from),b=N.byId.get(l.to),am=a.node.world,bm=b.node.world;
  const d=M.sub(point(bm,[0,0,0]),point(am,[0,0,0]));
  near(M.dot(vector(am,8),vector(bm,8)),1,1e-6);near(M.dot(d,vector(am,8)),0,3e-5);
  near(Math.hypot(...d),a.radius+b.radius,3e-5);near(a.speed*a.teeth,-b.speed*b.teeth,1e-8);
 }
});
test('actual rendered teeth face gaps throughout the shared animation',()=>{
 for(const t of [0,.125,12.345,731]){
  w.update(t,sample);
  for(const l of N.links.filter(l=>l.kind==='mesh')){
   const a=N.byId.get(l.from),b=N.byId.get(l.to),am=a.node.world,bm=b.node.world;
   const d=M.sub(point(bm,[0,0,0]),point(am,[0,0,0])),neg=M.mul(d,-1);
   const pa=Math.atan2(M.dot(d,vector(am,4)),M.dot(d,vector(am,0)));
   const pb=Math.atan2(M.dot(neg,vector(bm,4)),M.dot(neg,vector(bm,0)));
   near(Math.cos(a.teeth*pa+b.teeth*pb),-1,1e-7);
  }
 }
});
test('each visible shaft endpoint stays at its specified world-space connection',()=>{
 for(const t of [0,7,94]){
  w.update(t,sample);
  for(const p of N.parts.filter(p=>p.ends)){
   const actual=[point(p.node.world,[0,0,-p.length/2]),point(p.node.world,[0,0,p.length/2])];
   for(let i=0;i<2;i++)for(let k=0;k<3;k++)near(actual[i][k],p.ends[i][k],5e-5);
  }
 }
});
test('rear routing starts and ends in the original assembly hubs, not empty space',()=>{
 w.update(123,sample);
 for(const path of N.paths){
  assert.equal(path.shafts.length,path.points.length-1);
  for(const [id,index]of[[path.from,0],[path.to,path.points.length-1]]){
   const p=N.byId.get(id),expected=point(p.node.world,[0,0,-(p.backDepth||2)]);
   for(let k=0;k<3;k++)near(path.points[index][k],expected[k],4e-5);
  }
 }
});
test('the original three foreground wheels remain the only foreground gears',()=>{
 w.update(0,sample);
 const ids=N.parts.filter(p=>p.kind==='gear'&&p.node.world[14]>0).map(p=>p.id).sort();
 assert.deepEqual(Array.from(ids),['near-compound','near-flywheel','near-idler']);
 for(const [id,r]of[['near-flywheel',37],['near-compound',12],['near-idler',5]])assert.equal(N.byId.get(id).radius,r);
});
test('the new escapement gears stay behind the fixed clock face',()=>{
 w.update(0,sample);const m=w.clock.frame.world,normal=vector(m,8),centre=point(m,[0,0,0]);
 for(const mesh of w.connectionMeshes.filter(m=>m.role==='gear-teeth')){
  const g=mesh.geometry;
  for(let i=0;i<g.length;i+=6){const p=point(mesh.world,[g[i],g[i+1],g[i+2]]);assert.ok(M.dot(M.sub(p,centre),normal)<-14,mesh.assemblyId);}
 }
});
test('pendulum and escapement fork have exactly the same swing',()=>{
 for(let t=0;t<100;t+=.47){w.update(t,sample);near(N.byId.get('pendulum').node.rotation[2],N.byId.get('escape-anchor').node.rotation[2],1e-12);}
});
test('each half swing releases one mean tooth of the escape wheel',()=>{
 const p=N.byId.get('escape-wheel'),half=Math.PI/N.frequency;
 for(const t of [0,.3,10,200])near((N.sample(t+half).driveTime-N.sample(t).driveTime)*p.speed,-TAU/p.teeth,1e-9);
});
test('the pulsed drive remains monotonic, with no accidental reversals',()=>{
 let prev=N.sample(0).driveTime;
 for(let t=.025;t<150;t+=.025){const now=N.sample(t).driveTime;assert.ok(now>prev);prev=now;}
 assert.throws(()=>N.sample(NaN),/Invalid/);
});
test('both oblique rings maintain contact with their fixed-axis rear rollers',()=>{
 for(const t of [0,5,60]){
  w.update(t,sample);
  for(const l of N.links.filter(l=>l.kind==='rim-contact')){
   const a=N.byId.get(l.from),b=N.byId.get(l.to),d=M.sub(point(a.node.world,[0,0,0]),point(b.node.world,[0,0,0]));
   near(Math.hypot(...d),a.radius+b.radius,3e-5);near(M.dot(d,vector(b.node.world,8)),0,3e-5);
  }
 }
});
test('the coaxial foreground compound shares the flywheel axis and speed',()=>{
 w.update(51,sample);const a=N.byId.get('near-flywheel'),b=N.byId.get('near-compound'),d=M.sub(point(b.node.world,[0,0,0]),point(a.node.world,[0,0,0]));
 near(Math.hypot(...M.cross(d,vector(a.node.world,8))),0,1e-5);near(a.speed,b.speed,1e-12);
});
test('both clock hands are physically linked through independent timekeeping clutches',()=>{
 const links=N.links.filter(l=>l.kind==='clock-clutch');assert.equal(links.length,2);
 for(const l of links){assert.equal(N.byId.get(l.from).kind,'shaft');assert.equal(N.byId.get(l.to).kind,'hand');assert.equal(l.independentTime,true);assert.ok(l.visible);}
});
test('low quality never removes a gear or a functional connection',()=>{
 for(const m of w.meshes.filter(m=>m.role==='gear-teeth'))assert.ok(m.tier<=1);
 for(const m of w.connectionMeshes)assert.ok(m.tier<=1);
});
test('graph validation rejects duplicate parts, dangling connections and disconnected rotors',()=>{
 const n=new A.Mechanism();n.add('pendulum','oscillator',new A.Node());
 assert.throws(()=>n.add('pendulum','oscillator',new A.Node()),/Duplicate/);
 assert.throws(()=>n.connect('pendulum','missing','shaft'),/Invalid/);
 n.add('isolated','gear',new A.Node());assert.throws(()=>n.solve(),/Unconnected/);
 n.connect('pendulum','isolated','shaft',1);n.solve();assert.equal(n.summary().components,1);
 n.connect('pendulum','isolated','shaft',2);assert.throws(()=>n.solve(),/Conflicting/);
});
