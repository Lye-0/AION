import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),sb={window:{},console,Math,Float32Array,Map};vm.createContext(sb);
for(const name of ['math','geometry','clock','transmission','mechanism','linkage','world'])vm.runInContext(readFileSync(root+`src/${name}.js`,'utf8'),sb);
const A=sb.window.AION,TAU=Math.PI*2,near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),world=A.createWorld();
const epoch=(h,m=0,s=0,ms=0,day=11)=>new Date(2026,8,day,h,m,s,ms).getTime();
const cycle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
test('twelve points up and three, six, nine advance clockwise',()=>{for(const h of [0,3,6,9,12,15,18,21]){const s=A.Clock.sample(epoch(h));near(s.hourAngle,-TAU*(h%12)/12);near(s.minuteAngle,0);}});
test('both clock hands include seconds and milliseconds',()=>{const s=A.Clock.sample(epoch(4,41,15,500));near(s.minuteAngle,-TAU*(41+15.5/60)/60);near(s.hourAngle,-TAU*(4+41/60+15.5/3600)/12);});
test('noon and midnight do not change the direction of either hand',()=>{for(const h of [0,12]){const e=epoch(h),a=A.Clock.sample(e-1000),b=A.Clock.sample(e);near(cycle(b.minuteAngle,a.minuteAngle),A.Clock.MINUTE_RATE);near(cycle(b.hourAngle,a.hourAngle),A.Clock.HOUR_RATE);}});
test('invalid clock timestamps are rejected',()=>{assert.throws(()=>A.Clock.sample(NaN),/無効/);assert.throws(()=>A.Clock.sample(Infinity),/無効/);});
test('the clock follows the device timezone, not a hard-coded Japan offset',()=>{
 const code=`const vm=require('vm'),fs=require('fs');const s={window:{AION:{}}};vm.createContext(s);vm.runInContext(fs.readFileSync(${JSON.stringify(root+'src/clock.js')},'utf8'),s);console.log(JSON.stringify(s.window.AION.Clock.sample(Date.parse('2026-09-11T03:15:30.500Z'))));`;
 for(const [TZ,h,m] of [['Asia/Tokyo',12,15],['UTC',3,15],['America/New_York',23,15],['Asia/Kolkata',8,45]]){
  const r=spawnSync(process.execPath,['-e',code],{env:{...process.env,TZ},encoding:'utf8'});assert.equal(r.status,0,r.stderr);const s=JSON.parse(r.stdout);assert.equal(s.hours,h);assert.equal(s.minutes,m);assert.equal(s.seconds,30);
 }
});
test('the real clock is independent of exhibition time and speed',()=>{const now=A.Clock.sample(epoch(10,8,24,125));for(const t of [0,1,300,86400]){world.update(t,now);near(world.clock.hour.rotation[2],now.hourAngle);near(world.clock.minute.rotation[2],now.minuteAngle);}});
test('hands advance while every exhibition rotor stays paused',()=>{const a=A.Clock.sample(epoch(10,0)),b=A.Clock.sample(epoch(10,1));world.update(7,a);const old=world.rotors.map(r=>r.node.rotation[r.axis]);world.update(7,b);near(world.clock.minute.rotation[2],b.minuteAngle);world.rotors.forEach((r,i)=>near(r.node.rotation[r.axis],old[i]));});
test('the fixed clock indices do not rotate with ornamental rings',()=>{world.update(0,A.Clock.sample(epoch(0)));const before=world.clock.indices.map(n=>Array.from(n.world));world.update(1800,A.Clock.sample(epoch(12)));world.clock.indices.forEach((n,i)=>assert.deepEqual(Array.from(n.world),before[i]));assert.equal(world.clock.indices.length,36);});
test('hour and minute hands share the fixed dial normal and pivot',()=>{for(const n of [world.clock.hour,world.clock.minute]){near(n.position[0],0);near(n.position[1],0);for(let i=8;i<11;i++)near(n.world[i],world.clock.frame.world[i],1e-6);}});
test('rear gear graph is a single connected network of 56 gears',()=>{const t=world.transmission,seen=new Set([t.minute]);while(true){const before=seen.size;for(const l of t.links){if(seen.has(l.from))seen.add(l.to);if(seen.has(l.to))seen.add(l.from);}if(before===seen.size)break;}assert.equal(t.parts.length,56);assert.equal(seen.size,t.parts.length);assert.equal(t.links.length,t.parts.length-1);});
test('every gear uses the same tooth module and tangent pitch circles',()=>{const t=world.transmission;for(const p of t.parts)near(2*p.radius/p.teeth,t.module);for(const l of t.links.filter(l=>l.kind==='mesh')){const a=t.byId.get(l.from),b=t.byId.get(l.to);near(a.position[2],b.position[2]);near(Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1]),a.radius+b.radius);}});
test('all meshing pairs have opposite directions and exact inverse tooth ratios',()=>{const t=world.transmission;for(const l of t.links.filter(l=>l.kind==='mesh')){const a=t.byId.get(l.from),b=t.byId.get(l.to);assert.ok(a.speed*b.speed<0);near(a.speed*a.teeth+b.speed*b.teeth,0);}});
test('teeth meet gaps rather than opposing teeth throughout the day',()=>{const t=world.transmission;for(const seconds of [0,.125,65953,86400,1789118353])for(const l of t.links.filter(l=>l.kind==='mesh')){const a=t.byId.get(l.from),b=t.byId.get(l.to),phi=Math.atan2(b.position[1]-a.position[1],b.position[0]-a.position[0]);const aa=a.phase+(seconds*a.speed)%TAU,bb=b.phase+(seconds*b.speed)%TAU;const sum=a.teeth*(phi-aa)+b.teeth*(phi+Math.PI-bb);near(Math.cos(sum),-1,1e-6);}});
test('coaxial stages have a common axis and speed',()=>{const t=world.transmission;assert.equal(t.links.filter(l=>l.kind==='shaft').length,6);for(const l of t.links.filter(l=>l.kind==='shaft')){const a=t.byId.get(l.from),b=t.byId.get(l.to);near(a.position[0],b.position[0]);near(a.position[1],b.position[1]);near(a.speed,b.speed);near(a.phase,b.phase);assert.notEqual(a.position[2],b.position[2]);}});
test('minute-to-hour reduction is 12:1 and the deep drive is 60:1',()=>{const t=world.transmission;near(t.byId.get(t.minute).speed/t.byId.get(t.hour).speed,12);near(Math.abs(t.byId.get(t.input).speed/t.byId.get(t.minute).speed),60);near(t.byId.get(t.input).speed,-world.network.frequency);assert.notEqual(t.byId.get(t.hour).speed,A.Clock.HOUR_RATE);});
test('unconnected gear bodies do not overlap within a transmission plane',()=>{const parts=world.transmission.parts;for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const a=parts[i],b=parts[j];if(a.position[2]!==b.position[2])continue;const distance=Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1]);assert.ok(distance>=a.radius+b.radius-1e-7,`${a.id} overlaps ${b.id}`);}});
test('local midnight cannot move the paused mechanical drive',()=>{const e=epoch(0,0,0,0,12),a=A.Clock.sample(e-1000),b=A.Clock.sample(e);near(b.driveSeconds-a.driveSeconds,1);world.update(10,a);const old=world.transmission.parts.map(p=>p.node.rotation[2]);world.update(10,b);world.transmission.parts.forEach((p,i)=>near(cycle(p.node.rotation[2],old[i]),0,1e-7));});
test('the v1.1 rear train remains at least 14 units behind the clock plane',()=>{
 world.update(0,A.Clock.sample(epoch(4,41)));const frame=world.clock.frame.world,n=[frame[8],frame[9],frame[10]],c=[frame[12],frame[13],frame[14]],bounds=new Map();
 for(const mesh of world.rearMeshes){const g=mesh.geometry;if(!bounds.has(g)){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<g.length;i+=6)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],g[i+k]);hi[k]=Math.max(hi[k],g[i+k]);}bounds.set(g,{lo,hi});}
  const {lo,hi}=bounds.get(g),m=mesh.world,axis=[0,1,2].map(k=>n[0]*m[k*4]+n[1]*m[k*4+1]+n[2]*m[k*4+2]);let depth=n[0]*(m[12]-c[0])+n[1]*(m[13]-c[1])+n[2]*(m[14]-c[2]);for(let k=0;k<3;k++)depth+=axis[k]*(axis[k]>0?hi[k]:lo[k]);assert.ok(depth<-14,`new mesh is too far forward: ${depth}`);
 }
});
test('stationary foreground architecture is unchanged from v1.1',()=>{
 world.update(0,A.Clock.sample(epoch(0)));
 const expected=JSON.parse(readFileSync(root+'tests/fixtures/protected-foreground-v1.1.json','utf8'));
 const roots=new Set([...world.rotors.map(r=>r.node),...world.pendulums.map(p=>p.node),world.clock.minute,world.clock.hour]),dynamic=new Set();
 function walk(n,on=false){on=on||roots.has(n);if(on)dynamic.add(n);for(const c of n.children)walk(c,on);}walk(world.root);
 const meshes=world.meshes.filter(m=>!dynamic.has(m)&&m.world[14]>0),h=createHash('sha256');
 for(const m of meshes){h.update(Buffer.from(m.geometry.buffer,m.geometry.byteOffset,m.geometry.byteLength));h.update(Buffer.from(m.world.buffer,m.world.byteOffset,m.world.byteLength));h.update(JSON.stringify(m.material));}
 assert.equal(meshes.length,expected.meshes);assert.equal(h.digest('hex'),expected.sha256);
});
