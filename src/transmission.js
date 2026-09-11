/* Rear-only kinematic gear graph. Radius is the pitch radius; module = 0.5.
 * Every external mesh has tangent pitch circles, opposing rotations and
 * tooth-indexed phase. Coaxial stages share a spindle and angular speed.
 * This is a visual mechanism, not a torque/contact/escapement simulation.
 */
'use strict';
(() => {
 const A=window.AION,TAU=Math.PI*2;
 function createTransmission(){
  const parts=[],links=[],byId=new Map();
  function add(id,position,radius,speed,phase=0){
   if(byId.has(id))throw new Error('Duplicate transmission part: '+id);
   const part={id,position:[...position],radius,teeth:Math.round(radius*4),speed,phase};
   parts.push(part);byId.set(id,part);return part;
  }
  function mesh(id,parentId,radius,direction){
   const parent=byId.get(parentId),length=Math.hypot(...direction);
   if(!parent||!length)throw new Error('Invalid gear connection: '+id);
   const phi=Math.atan2(direction[1],direction[0]),distance=parent.radius+radius;
   const position=[parent.position[0]+direction[0]/length*distance,parent.position[1]+direction[1]/length*distance,parent.position[2]];
   const teeth=Math.round(radius*4),ratio=parent.teeth/teeth;
   const phase=phi+Math.PI+Math.PI/teeth+ratio*(phi-parent.phase);
   const part=add(id,position,radius,-parent.speed*ratio,phase);
   links.push({kind:'mesh',from:parentId,to:id});return part;
  }
  function coax(id,parentId,radius,z){
   const parent=byId.get(parentId);
   if(!parent)throw new Error('Invalid spindle: '+id);
   const part=add(id,[parent.position[0],parent.position[1],z],radius,parent.speed,parent.phase);
   links.push({kind:'shaft',from:parentId,to:id});return part;
  }
  // Motion works: 40:120 followed by 32:128 = a 12:1 reduction.
  add('minute-spindle',[0,0,-26],10,A.Clock.MINUTE_RATE);
  mesh('motion-wheel','minute-spindle',30,[4,-3]);
  coax('motion-pinion','motion-wheel',8,-46);
  mesh('hour-wheel','motion-pinion',32,[-4,3]);
  // Upstream train: 5 x 4 x 3 = 60. The deep input turns once per minute.
  coax('minute-barrel','minute-spindle',30,-68);
  mesh('third-pinion','minute-barrel',6,[-4,3]);
  coax('third-wheel','third-pinion',24,-90);
  mesh('fourth-pinion','third-wheel',6,[4,3]);
  coax('fourth-wheel','fourth-pinion',18,-110);
  mesh('seconds-pinion','fourth-wheel',6,[4,3]);
  coax('seconds-wheel','seconds-pinion',22,-134);
  mesh('drive-return','seconds-wheel',12,[4,-3]);
  coax('drive-wheel','drive-return',26,-158);
  mesh('deep-flywheel','drive-wheel',38,[-1,0]);
  // Interlocking branches fill the space BEHIND the open clock, not its face.
  mesh('near-west','minute-spindle',18,[-1,0]);
  mesh('near-far-west','near-west',12,[-4,-3]);
  mesh('near-south-west','near-west',12,[0,-1]);
  mesh('near-lower-idler','near-south-west',10,[0,-1]);
  mesh('near-lower-wheel','near-lower-idler',16,[-1,0]);
  mesh('near-upper-west','near-west',14,[0,1]);
  mesh('near-upper-idler','near-upper-west',10,[4,3]);
  mesh('near-upper-wheel','near-upper-idler',20,[1,0]);
  mesh('near-east','motion-wheel',12,[1,0]);
  mesh('near-east-wheel','near-east',20,[0,1]);
  mesh('near-east-upper','near-east-wheel',14,[0,1]);
  mesh('near-east-crown','near-east-upper',10,[0,1]);
  // A second return train stays on the hour-output plane.
  mesh('hour-west','hour-wheel',12,[-1,0]);
  mesh('hour-north-west','hour-west',10,[-3,4]);
  mesh('hour-south-west','hour-west',14,[-3,-4]);
  mesh('hour-south','hour-wheel',14,[0,-1]);
  mesh('hour-north','hour-wheel',12,[0,1]);
  mesh('hour-north-east','hour-north',16,[1,0]);
  // Middle layers use the same pitch module and real, continuous shafts.
  mesh('middle-east','minute-barrel',18,[1,0]);
  mesh('middle-south-east','middle-east',14,[0,-1]);
  mesh('middle-lower-idler','middle-south-east',8,[-1,0]);
  mesh('middle-south','minute-barrel',12,[0,-1]);
  mesh('middle-south-west','middle-south',18,[-1,0]);
  mesh('middle-far-west','middle-south-west',24,[-1,0]);
  mesh('middle-north','minute-barrel',14,[0,1]);
  mesh('middle-north-idler','middle-north',10,[-1,0]);
  mesh('middle-north-west','middle-north-idler',22,[-1,0]);
  mesh('third-east','third-wheel',16,[1,0]);
  mesh('third-far-east','third-east',12,[1,0]);
  mesh('third-south-east','third-far-east',20,[0,-1]);
  mesh('third-lower-idler','third-south-east',8,[-1,0]);
  mesh('third-west','third-wheel',12,[-1,0]);
  mesh('third-south-west','third-west',18,[0,-1]);
  mesh('third-lower-west','third-south-west',12,[0,-1]);
  mesh('fourth-west','fourth-wheel',30,[-4,-3]);
  mesh('fourth-south','fourth-west',20,[0,-1]);
  mesh('fourth-south-idler','fourth-south',10,[1,0]);
  mesh('seconds-west','seconds-wheel',12,[-1,0]);
  mesh('seconds-lower','drive-return',24,[0,-1]);
  mesh('seconds-lower-west','seconds-lower',12,[-1,0]);
  mesh('deep-south','deep-flywheel',20,[0,-1]);
  mesh('deep-south-east','deep-south',16,[1,0]);
  return {parts,links,byId,input:'seconds-pinion',minute:'minute-spindle',hour:'hour-wheel',module:.5};
 }
 A.createTransmission=createTransmission;
})();
