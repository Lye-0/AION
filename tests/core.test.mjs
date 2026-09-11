import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const sandbox={window:{},console,Float32Array,Math,Map};vm.createContext(sandbox);
for(const name of['math','geometry','clock','transmission','mechanism','linkage','world','controls'])vm.runInContext(readFileSync(fileURLToPath(new URL(`../src/${name}.js`,import.meta.url)),'utf8'),sandbox);
const A=sandbox.window.AION,M=A.M,near=(x,y)=>assert.ok(Math.abs(x-y)<1e-5,`${x} != ${y}`);
const world=A.createWorld();
test('matrix multiplication preserves identity',()=>{const a=M.compose([3,5,7],[.1,.4,.9],[2,3,4]);assert.deepEqual(M.mm(M.identity(),a),a);assert.deepEqual(M.mm(a,M.identity()),a);});
test('parent/child transforms propagate changes',()=>{const p=new A.Node([10,0,0]),c=p.add(new A.Node([0,4,0]));p.update();near(c.world[12],10);near(c.world[13],4);p.position[0]=20;p.refresh();p.update();near(c.world[12],20);});
test('lookAt maps the camera position to the origin',()=>{const e=[2,8,13],v=M.lookAt(e,[0,0,0]);for(let r=0;r<3;r++)near(v[r]*e[0]+v[4+r]*e[1]+v[8+r]*e[2]+v[12+r],0);});
test('procedural world is substantial and all geometry is finite',()=>{assert.ok(world.meshes.length>1000);for(const geo of new Set(world.meshes.map(m=>m.geometry))){assert.equal(geo.length%18,0);for(const value of geo)assert.ok(Number.isFinite(value));}});
test('all world transforms and material values are finite',()=>{world.update(86400);for(const m of world.meshes){for(const v of m.world)assert.ok(Number.isFinite(v));for(const v of m.material)assert.ok(Number.isFinite(v));}});
test('animation depends on elapsed time, not frame count',()=>{world.update(5);const expected=world.rotors.map(r=>r.node.rotation[r.axis]);for(let i=0;i<=100;i++)world.update(i*.05);world.rotors.forEach((r,i)=>near(r.node.rotation[r.axis],expected[i]));});
test('the main transmission uses inverse tooth ratios',()=>{
 const n=world.network.byId,a=n.get('main-annulus'),b=n.get('dial-east'),c=n.get('dial-east-idler');
 near(a.speed*a.teeth,-b.speed*b.teeth);near(b.speed*b.teeth,-c.speed*c.teeth);
});
test('pendulum stays within its physical swing envelope',()=>{for(let t=0;t<60;t+=.7){world.update(t);for(const p of world.pendulums)assert.ok(Math.abs(p.node.rotation[2])<=p.amplitude+1e-8);}});
test('the paused world is deterministic',()=>{world.update(12.5);const before=world.meshes.map(m=>Array.from(m.world));world.update(12.5);world.meshes.forEach((m,i)=>assert.deepEqual(Array.from(m.world),before[i]));});
test('three camera views have valid distinct positions',()=>{assert.equal(A.VIEWS.length,3);assert.equal(new Set(A.VIEWS.map(v=>v.eye.join(','))).size,3);for(const v of A.VIEWS){assert.ok(v.fov>20&&v.fov<90);assert.ok(Math.hypot(...M.sub(v.eye,v.target))>10);}});
test('seeded random values are repeatable and bounded',()=>{const a=M.seeded(1771),b=M.seeded(1771);for(let i=0;i<200;i++){const x=a();assert.equal(x,b());assert.ok(x>=0&&x<1);}});
function mockCanvas(width=1000,height=740){return {clientWidth:width,clientHeight:height,addEventListener(){},removeEventListener(){},setPointerCapture(){},classList:{add(){},remove(){}}};}
test('all camera presets ease to the destination without jumping',()=>{
 const controls=new A.CameraControls(mockCanvas());controls.drift=false;controls.update(0,0);
 for(const index of[1,2,0]){
  const before=[...controls.eye];controls.setPreset(index);assert.deepEqual([...controls.eye],before);
  controls.update(.1,0);assert.notDeepEqual([...controls.eye],before);assert.ok(controls.tween);
  for(let frame=0;frame<60;frame++)controls.update(.05,0);
  assert.equal(controls.tween,null);controls.eye.forEach((v,i)=>near(v,A.VIEWS[index].eye[i]));
  controls.target.forEach((v,i)=>near(v,A.VIEWS[index].target[i]));near(controls.fov,A.VIEWS[index].fov);
 }
 controls.dispose();
});
test('portrait framing and interrupted camera transitions remain valid',()=>{
 const controls=new A.CameraControls(mockCanvas(390,844));controls.drift=false;controls.update(0,0);
 assert.deepEqual([...controls.target],[14,19,-20]);near(controls.fov,57);
 controls.setPreset(2);for(let frame=0;frame<61;frame++)controls.update(.05,0);
 assert.equal(controls.tween,null);assert.deepEqual([...controls.target],[-23,16,-18]);near(controls.fov,56);
 controls.setPreset(1);controls.update(.2,0);controls.cancelDrift();assert.equal(controls.tween,null);
 controls.update(.2,0);for(const value of controls.vp)assert.ok(Number.isFinite(value));controls.dispose();
});
