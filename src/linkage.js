/* Visible connections between the formerly independent assemblies.
 * Long keyed shafts, rear universal joints, rim rollers and the pendulum fork
 * are built as actual meshes, not just entries in a connectivity graph.
 */
'use strict';
(() => {
 const A=window.AION,M=A.M,{add,sub,mul,dot,norm,TAU}=M;
 A.buildLinkage=function(c){
  const {root,network:N,transmission:T,clockFrame,pend,meshes,register,group,
   box,ring,cylinder,rotor,gear,bolts,MAT}=c;
  const start=meshes.length,paths=[];let serial=0;
  const part=id=>{const p=N.byId.get(id);if(!p)throw new Error('Missing connection endpoint: '+id);return p;};
  const point=(m,p)=>[0,1,2].map(k=>m[12+k]+m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]);
  const pose=id=>{
   root.update();const p=part(id),m=p.node.world;
   return {p,centre:[m[12],m[13],m[14]],normal:norm([m[8],m[9],m[10]]),m};
  };
  const basis=direction=>{const d=norm(direction);return [Math.atan2(-d[1],d[2]),Math.asin(Math.max(-1,Math.min(1,d[0]))),0];};
  const back=id=>{const p=pose(id);return {...p,point:sub(p.centre,mul(p.normal,p.p.backDepth||2))};};
  function meshPair(from,to,rephase=true){
   const a=pose(from),b=pose(to),d=sub(b.centre,a.centre);
   if(rephase){
    const phiA=Math.atan2(dot(d,[a.m[4],a.m[5],a.m[6]]),dot(d,[a.m[0],a.m[1],a.m[2]]))+a.p.phase;
    const phiB=Math.atan2(dot(mul(d,-1),[b.m[4],b.m[5],b.m[6]]),dot(mul(d,-1),[b.m[0],b.m[1],b.m[2]]))+b.p.phase;
    b.p.phase=phiB-Math.PI/b.p.teeth+a.p.teeth/b.p.teeth*(phiA-a.p.phase);
    b.p.node.rotation[2]=b.p.phase;b.p.node.refresh();
   }
   return N.connect(from,to,'mesh',-a.p.teeth/b.p.teeth,{contact: add(a.centre,mul(norm(d),a.p.radius))});
  }
  function shaftSegment(from,a,b,label,radius=.58){
   const delta=sub(b,a),length=Math.hypot(...delta);
   if(length<.05)return from;
   const orientation=basis(delta),mount=group(root,mul(add(a,b),.5),orientation);
   const axle=rotor(mount,[0,0,0],[0,0,0],0),id=`shaft-${++serial}:${label}`;
   register(id,'shaft',axle,{ends:[a,b],length,backDepth:0});
   const body=cylinder(axle,[0,0,0],radius,length+.15,MAT.steel);body.role='drive-shaft';
   box(axle,[radius*.97,0,0],[.14,.19,Math.max(.1,length-.3)],MAT.brass);
   for(const sign of[-1,1]){
    const z=sign*Math.max(0,length/2-Math.min(1.1,length*.2));
    ring(axle,radius*1.9,radius*.96,.68,MAT.brass,[0,0,z]);
    ring(axle,radius*2.02,radius*1.71,.16,MAT.titanium,[0,0,z+sign*.4]);
    bolts(axle,4,radius*1.47,z+sign*.43,.085);
    if(length>10){
     const zz=sign*(length/2-3.6);
     ring(mount,radius*2.65,radius*2.06,1.25,MAT.iron,[0,0,zz]);
     box(mount,[0,-radius*2.9,zz],[radius*4.4,radius*1.1,1.5],MAT.iron);
    }
   }
   N.connect(from,id,'shaft',1,{point:a,visible:true});return id;
  }
  const adapters=new Set();
  function hubAdapter(id,radius){
   if(adapters.has(id))return;adapters.add(id);
   const p=part(id),depth=p.backDepth||2;
   const ro=Math.max(radius*1.24,p.kind==='gear'?p.radius*.17*.65:radius*1.8);
   const coupling=ring(p.node,ro,radius*.90,1.8,MAT.brass,[0,0,-depth+.6]);
   coupling.role='hub-coupling';
   ring(p.node,ro*1.06,ro*.86,.32,MAT.titanium,[0,0,-depth-.25]);
  }
  function shaftPath(from,to,{radius=.58,ratio=1}={}){
   hubAdapter(from,radius);hubAdapter(to,radius);
   const a=back(from),b=back(to),z=Math.min(a.point[2],b.point[2])-10;
   const project=v=>sub(v.point,mul(v.normal,(v.point[2]-z)/Math.max(.15,v.normal[2])));
   const aa=project(a),bb=project(b),bend=[bb[0],aa[1],z];
   const pts=[a.point,aa,bend,bb,b.point].filter((p,i,all)=>i===0||Math.hypot(...sub(p,all[i-1]))>.05);
   const shafts=[];let previous=from;
   for(let i=1;i<pts.length;i++){
    previous=shaftSegment(previous,pts[i-1],pts[i],to,radius);shafts.push(previous);
    if(i<pts.length-1){
     // Open, crossed yokes enclose the change of axis; shafts meet at their centre.
     const joint=group(root,pts[i]);
     ring(joint,radius*2.3,radius*1.58,.62,MAT.darkGold,[0,0,0],basis(sub(pts[i],pts[i-1])));
     ring(joint,radius*2.3,radius*1.58,.62,MAT.titanium,[0,0,0],basis(sub(pts[i+1],pts[i])));
     cylinder(joint,[0,0,0],radius*1.34,radius*2.1,MAT.brass);
    }
   }
   N.connect(previous,to,ratio===1?'shaft':'enclosed-transfer',ratio,{point:b.point,visible:true});
   paths.push({from,to,points:pts,shafts});return shafts;
  }
  function beam(parent,a,b,width,depth,material){
   const d=sub(b,a),length=Math.hypot(d[0],d[1]);
   return box(parent,mul(add(a,b),.5),[length,width,depth],material,[0,0,Math.atan2(d[1],d[0])]);
  }

  // Preserve the validated rear tooth contacts, but feed them from ONE oscillator.
  for(const l of T.links){
   if(l.kind==='mesh')meshPair(l.from,l.to,false);
   else{
    const id='compound-shaft:'+l.from;
    N.connect(l.from,id,'shaft',1,{visible:true});N.connect(id,l.to,'shaft',1,{visible:true});
   }
  }

  // Pendulum suspension -> fork -> escape wheel -> two compound stages -> rear train.
  // The fork visibly rocks at the same angle as the full-height pendulum.
  const escape=gear(root,[-34,54,-37],12,48,0,{id:'escape-wheel',depth:2.3,spokes:6,mat:MAT.brass,compact:true});
  const anchor=group(root,[-34,69,-37]);register('escape-anchor','anchor',anchor,{mode:'swing'});
  const rod=cylinder(pend,[0,0,-17.8],1.03,35.6,MAT.steel);
  ring(anchor,2.25,1.02,1.8,MAT.brass);
  for(const side of[-1,1]){
   beam(anchor,[0,-.4,0],[side*9,-5.5,0],1.22,1.25,MAT.iron);
   beam(anchor,[side*9,-5.5,0],[side*8.95,-7.85,0],1.35,2.25,MAT.brass);
   box(anchor,[side*8.95,-7.85,.9],[1.7,.7,.8],MAT.edge,[0,0,side*.30]);
   cylinder(anchor,[side*7.1,-4.55,.8],.3,.34,MAT.titanium);
  }
  N.connect('pendulum','escape-anchor','rigid-link',1,{geometry:[rod],visible:true});
  N.connect('escape-anchor','escape-wheel','escapement',-2/48,{visible:true,pallets:2});
  gear(root,[-19,54,-37],3,12,0,{id:'escape-pinion',depth:1.7,spokes:5,mat:MAT.titanium,compact:true});
  gear(root,[-19,54,-59],15,60,0,{id:'escape-compound',depth:2.2,spokes:6,mat:MAT.darkGold,compact:true});
  gear(root,[-1.5,54,-59],2.5,10,0,{id:'escape-output',depth:1.6,spokes:5,mat:MAT.brass,compact:true});
  meshPair('escape-wheel','escape-pinion');
  // This straight shaft is coaxial: avoid an unnecessary dogleg behind the fork.
  root.update();const coaxA=pose('escape-pinion').centre,coaxB=pose('escape-compound').centre;
  const coax=shaftSegment('escape-pinion',coaxA,coaxB,'escape-compound',.55);
  N.connect(coax,'escape-compound','shaft',1,{visible:true});
  meshPair('escape-compound','escape-output');
  shaftPath('escape-output',T.input,{radius:.58});

  // The three front gears now share the dial's plane and truly meet its teeth.
  meshPair('main-annulus','dial-east');meshPair('dial-east','dial-east-idler');meshPair('dial-east-idler','dial-lower');
  shaftPath('third-wheel','dial-east',{radius:.76});

  // The near flywheel's existing axle is extended, not supplemented with front gears.
  meshPair('near-flywheel','near-idler');
  N.connect('near-flywheel','near-compound','shaft',1,{visible:true,sharedAxle:true});
  shaftPath('near-far-west','near-flywheel',{radius:.88});
  meshPair('upper-west','upper-west-idler');
  shaftPath('third-wheel','upper-west',{radius:.67});
  shaftPath('middle-north','overhead',{radius:1.0});

  // An actual spoked rear carrier now connects the giant deep annulus to its axle.
  shaftPath('minute-barrel','deep-annulus',{radius:1.0});
  // The distant wheels used to be isolated set dressing. Each now has a back axle
  // feeding into the next transmission, selected by spatial proximity.
  const pool=['deep-annulus','third-wheel','third-east','third-far-east','third-south-west','fourth-west'];
  const far=Array.from({length:9},(_,i)=>`deep-wheel-${i}`);
  far.sort((a,b)=>pose(b).centre[2]-pose(a).centre[2]);
  for(const id of far){
   const end=back(id).point;
   const source=pool.reduce((best,x)=>Math.hypot(...sub(back(x).point,end))<Math.hypot(...sub(back(best).point,end))?x:best,pool[0]);
   shaftPath(source,id,{radius:.7});pool.push(id);
  }

  // Oblique rings rotate about FIXED normals now. Small powered rollers touch
  // their rearmost arcs; their shafts never need to cross in front of the face.
  for(const [id,source]of[['halo','fourth-wheel'],['oblique-ring','fourth-west']]){
   const p=pose(id),r=p.p.radius,rr=3.2;
   const u=-p.m[2],v=-p.m[6],l=Math.hypot(u,v),local=[u/l,v/l];
   const location=point(p.m,[local[0]*(r+rr),local[1]*(r+rr),0]);
   const mount=group(root,location,basis(p.normal)),roller=rotor(mount,[0,0,0],[0,0,0],0),rid=id+'-roller';
   cylinder(roller,[0,0,0],rr,2.3,MAT.iron);
   ring(roller,rr+.03,rr-.32,.4,MAT.brass,[0,0,1.35]);
   ring(roller,rr+.03,rr-.32,.4,MAT.brass,[0,0,-1.35]);
   cylinder(roller,[0,0,0],.61,8,MAT.steel);
   register(rid,'roller',roller,{radius:rr,backDepth:4});
   shaftPath(source,rid,{radius:.45});
   N.connect(rid,id,'rim-contact',-rr/r,{visible:true,contact:point(p.m,[local[0]*r,local[1]*r,0])});
  }
  shaftPath('minute-barrel','inner-carrier',{radius:.52});

  // Nested output sleeves physically reach the hand pivots. The coupling is
  // intentionally an artistic slip clutch: true time is NOT derived from gears.
  for(const [source,target,z,front,ro,ri]of[
   [T.minute,'minute-hand',-26,15,.99,.67],
   [T.hour,'hour-hand',-46,18,1.54,1.07]
  ]){
   const sleeve=rotor(clockFrame,[0,0,(z+front)/2],[0,0,0],0),id=target+'-sleeve';
   const tube=ring(sleeve,ro,ri,front-z,MAT.steel);tube.role='clock-output';
   register(id,'shaft',sleeve,{backDepth:(front-z)/2});
   for(const zz of[-(front-z)/2+3.5,-(front-z)/2+5.2])ring(sleeve,ro*1.35,ro*1.01,.85,MAT.brass,[0,0,zz]);
   N.connect(source,id,'shaft',1,{visible:true});
   N.connect(id,target,'clock-clutch',1,{visible:true,independentTime:true});
  }

  const added=meshes.slice(start);
  for(const m of added){m.region='connected-mechanism';m.tier=0;}
  N.paths=paths;
  return {meshes:added,paths};
 };
})();
