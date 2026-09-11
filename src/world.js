/* The impossible clock. Distances are an artistic scale, not an engineering plan. */
'use strict';
(() => {
 const A=window.AION,{TAU,seeded}=A.M,G=A.Geo;
 const material=(hex,metal=.86,rough=.36,emission=0,ao=1)=>{
  const n=parseInt(hex.replace('#',''),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,metal,rough,emission,ao,0];
 };
 const MAT={
  iron:material('#22292c',.86,.43),black:material('#101617',.82,.48),titanium:material('#6d706c',.91,.29),brass:material('#71624a',.89,.34),gold:material('#a69570',.9,.25),edge:material('#b5ad93',.94,.23),darkGold:material('#39392f',.9,.42),steel:material('#4e6066',.87,.37),light:material('#ffc98a',.1,.4,2.8),dimLight:material('#caaa75',.4,.4,.62),ceramic:material('#171e22',.18,.64)
 };
 function createWorld(){
  const root=new A.Node(),meshes=[],rotors=[],pendulums=[];let gearCount=0;const rng=seeded(1771);
  const group=(parent=root,p=[0,0,0],r=[0,0,0],s=[1,1,1])=>parent.add(new A.Node(p,r,s));
  function mesh(geometry,mat,parent=root,p=[0,0,0],r=[0,0,0],s=[1,1,1],tier=0){const n=group(parent,p,r,s);n.geometry=geometry;n.material=mat;n.tier=tier;meshes.push(n);return n;}
  const box=(parent,p,s,mat=MAT.iron,r=[0,0,0],tier=0)=>mesh(G.box(),mat,parent,p,r,s,tier);
  const ring=(parent,ro,ri,depth,mat=MAT.brass,p=[0,0,0],r=[0,0,0],tier=0)=>mesh(G.annulus(ro,ri,depth,ro>40?192:128,Math.min(depth*.26,.2)),mat,parent,p,r,[1,1,1],tier);
  const cylinderGeo=G.annulus(1,.001,1,48,.09);
  const cylinder=(parent,p,radius,length,mat=MAT.iron,r=[0,0,0],tier=0)=>mesh(cylinderGeo,mat,parent,p,r,[radius,radius,length],tier);
  function rotor(parent,p,r,speed,axis=2){const n=group(parent,p,r);rotors.push({node:n,axis,speed,phase:r[axis]});return n;}
  function radial(parent,count,radius,radialLength,width,depth,z,mat,offset=0,tier=0){
   for(let i=0;i<count;i++){const a=i*TAU/count+offset;box(parent,[Math.cos(a)*radius,Math.sin(a)*radius,z],[radialLength,width,depth],mat,[0,0,a],tier);}
  }
  function bolts(parent,count,radius,z,size=.18,tier=0){
   for(let i=0;i<count;i++){const a=i*TAU/count;cylinder(parent,[Math.cos(a)*radius,Math.sin(a)*radius,z],size,.13,MAT.edge,[0,0,a],tier);}
  }
  function gear(parent,p,radius,teeth,speed,options={}){
   gearCount++;const {depth=2.2,spokes=8,rotation=[0,0,0],tier=0,mat=MAT.brass,shaft=0}=options;
   const n=rotor(parent,p,rotation,speed);
   mesh(G.annulus(radius,radius*.77,depth,128,.14,teeth),mat,n,[0,0,0],[0,0,0],[1,1,1],tier);
   ring(n,radius*.79,radius*.765,.28,MAT.edge,[0,0,depth*.52],[0,0,0],tier);
   ring(n,radius-.85,radius-1.05,.18,MAT.titanium,[0,0,depth*.52],[0,0,0],tier);
   const hub=radius*.17;
   ring(n,hub,hub*.33,depth*1.6,MAT.iron,[0,0,0],[0,0,0],tier);
   ring(n,hub*.95,hub*.57,.5,MAT.gold,[0,0,depth*.9],[0,0,0],tier);
   ring(n,hub*.6,hub*.39,depth*2.4,MAT.titanium,[0,0,.3],[0,0,0],tier);
   for(let i=0;i<spokes;i++){
    const a=i*TAU/spokes,mid=radius*.48;
    box(n,[Math.cos(a)*mid,Math.sin(a)*mid,-.18],[radius*.61,radius*.052,depth*.65],MAT.iron,[0,0,a],tier);
    box(n,[Math.cos(a)*mid,Math.sin(a)*mid,depth*.31],[radius*.60,radius*.013,.13],mat,[0,0,a],tier);
    const aa=a+.023;box(n,[Math.cos(aa)*mid,Math.sin(aa)*mid,-depth*.33],[radius*.6,radius*.014,.16],MAT.titanium,[0,0,aa],tier);
   }
   bolts(n,spokes*2,radius*.86,depth*.61,radius*.009,tier);
   if(tier<2)radial(n,teeth,radius*.91,.3,.08,.09,depth*.6,MAT.darkGold,0,tier);
   if(shaft){cylinder(n,[0,0,-shaft*.45],hub*.35,shaft,MAT.steel,[0,0,0],tier);ring(n,hub*.63,hub*.35,.8,MAT.brass,[0,0,-shaft*.3],[0,0,0],tier);}
   return n;
  }
  // Monumental main annulus. A hollow mechanism rather than a conventional dial.
  const centre=[17,20,-20],main=rotor(root,centre,[-.055,.10,.10],.0105);
  mesh(G.annulus(45,40.8,3.7,192,.22,180),MAT.brass,main);
  ring(main,44.5,43.92,.43,MAT.edge,[0,0,2.0]);
  ring(main,42.55,41.95,.6,MAT.titanium,[0,0,2.1]);
  ring(main,41.02,40.8,.25,MAT.dimLight,[0,0,2.15]);
  ring(main,44.4,41.2,.7,MAT.iron,[0,0,-3.0]);
  ring(main,42.4,41.9,.2,MAT.gold,[0,0,-3.45]);
  radial(main,180,43.33,.47,.10,.12,2.27,MAT.darkGold);
  radial(main,36,43.3,1.16,.16,.12,2.28,MAT.edge,.007);
  radial(main,72,42.0,.45,.45,5.5,-.4,MAT.iron);
  bolts(main,72,44.17,2.32,.12);
  // A second offset retaining race remains fixed. Its supports sell the physical depth.
  const frame=group(root,centre,[-.055,.10,.10]);
  ring(frame,47.35,46.75,1.3,MAT.iron,[0,0,-4.4]);
  ring(frame,47.37,47.12,.2,MAT.titanium,[0,0,-3.72]);
  for(let i=0;i<12;i++){
   const a=TAU*i/12;const shoe=group(frame,[46.5*Math.cos(a),46.5*Math.sin(a),-1.8],[0,0,a]);
   box(shoe,[0,0,0],[2.6,2.4,6.6],MAT.iron);box(shoe,[1.1,0,3.4],[.25,1.45,.18],MAT.gold);
   cylinder(shoe,[.1,0,3.4],.33,.25,MAT.steel);box(shoe,[1.36,0,2.4],[.09,.35,.15],MAT.light);
  }
  const halo=rotor(root,centre,[.48,-.43,-.32],-.018);
  ring(halo,37.7,36.75,1.8,MAT.titanium);
  ring(halo,37.78,37.54,.28,MAT.gold,[0,0,1.0]);
  ring(halo,36.85,36.69,.13,MAT.dimLight,[0,0,.97]);
  radial(halo,96,37.23,.60,.09,.1,1.04,MAT.iron);
  bolts(halo,24,37.23,1.1,.115);
  const oblique=rotor(root,[17,20,-18],[1.12,.2,.38],.007,1);
  ring(oblique,39.3,38.5,1.5,MAT.brass);
  ring(oblique,39.33,39.1,.2,MAT.edge,[0,0,.85]);
  radial(oblique,72,38.9,.5,.14,.14,.92,MAT.darkGold);
  // A fragmented inner race and architectural arms, deliberately without hour numerals.
  const inner=rotor(root,[17,20,-14],[-.2,.05,0],-.021);
  ring(inner,29.6,29.24,.65,MAT.darkGold);
  ring(inner,29.27,29.16,.1,MAT.gold,[0,0,.4]);
  for(let i=0;i<3;i++){
   const a=TAU*i/3+.45;const arm=group(inner,[0,0,-1.8],[0,0,a]);
   box(arm,[14,0,0],[27,.52,1.2],MAT.iron);box(arm,[14,.3,.65],[26,.06,.13],MAT.titanium);
   box(arm,[27.9,0,0],[2.1,2.8,2.8],MAT.brass);cylinder(arm,[28.2,0,1.7],.48,.6,MAT.titanium);
  }
  const hub=group(root,[17,20,-11]);
  mesh(G.lathe([[.001,-13],[2.2,-13],[2.2,-9],[3.9,-9],[4.3,-8],[4.3,-3],[3.6,-2],[3.6,3],[2.2,4],[2.2,7],[.001,7]],80),MAT.iron,hub);
  ring(hub,4.55,3.65,.5,MAT.gold,[0,0,-2]);ring(hub,3.65,2.8,.45,MAT.edge,[0,0,3.4]);ring(hub,2.88,1.3,.7,MAT.brass,[0,0,4.2]);
  ring(hub,1.36,.85,.5,MAT.dimLight,[0,0,4.7]);cylinder(hub,[0,0,5],.73,.8,MAT.black);bolts(hub,12,3.15,3.9,.14);
  const needle=rotor(root,[17,20,-5],[.035,.03,-.62],.014);
  const blade=G.prism([[-.72,-9],[.72,-9],[1.1,23],[.19,36],[0,39],[-.19,36],[-1.1,23]],.7);
  mesh(blade,MAT.edge,needle);box(needle,[0,11,.43],[.15,35,.09],MAT.brass);
  ring(needle,3.2,2.48,.7,MAT.brass,[0,-10,0]);box(needle,[0,-7,0],[1.4,5,1.2],MAT.iron);
  const needle2=rotor(root,[17,20,-2],[0,0,1.62],-.006);
  mesh(blade,MAT.darkGold,needle2,[0,0,0],[0,0,0],[.7,.67,.8]);box(needle2,[0,8,.36],[.09,22,.10],MAT.gold);
  // A same-module train. Tangent pitch circles and reciprocal tooth ratios.
  const trainA=gear(root,[65.8,-19.82,-20],18,72,-.0105*180/72,{depth:3.2,spokes:8,mat:MAT.titanium,shaft:43});
  const trainB=gear(root,[89.8,-37.82,-20],12,48,.0105*180/48,{depth:2.8,spokes:6,mat:MAT.brass,shaft:68});
  const trainC=gear(root,[84.9,-65.38,-20],16,64,-.0105*180/64,{depth:3.0,spokes:8,mat:MAT.iron,shaft:30});
  gearCount++; // the annular driver
  // Near field: massive, cropped flywheel and long coaxial machine parts.
  gear(root,[-49,-38,28],37,148,-.014,{depth:5.5,spokes:9,mat:MAT.iron,rotation:[.02,-.12,.12],shaft:60});
  gear(root,[-48,-38,59],12,48,-.014,{depth:3,spokes:6,mat:MAT.brass});
  gear(root,[-13,-59,28],5,20,.014*148/20,{depth:3.0,spokes:5,mat:MAT.titanium});
  const overhead=gear(root,[85,88,-42],46,184,.006,{depth:5,spokes:12,mat:MAT.iron,shaft:80});
  gear(root,[-37,57,-61],20,80,-.024,{depth:3.5,spokes:7,mat:MAT.brass,shaft:45});
  gear(root,[-64,31,-61],17.5,70,.024*80/70,{depth:2.9,spokes:8,mat:MAT.iron,shaft:50});
  // The slow pendulum, suspended from an axle above the entire main assembly.
  const pivot=group(root,[-34,69,-2]);const pend=group(pivot,[0,0,0],[0,0,.095]);pendulums.push({node:pend,amplitude:.115,frequency:.37,phase:.4});
  cylinder(pivot,[0,0,0],3.1,15,MAT.iron);ring(pivot,3.3,2.75,.6,MAT.brass,[0,0,7.8]);
  for(const x of[-.7,.7])box(pend,[x,-49,0],[.40,98,.62],MAT.titanium);
  box(pend,[0,-49,-.5],[1.8,98,.25],MAT.iron);
  for(let j=1;j<14;j++)box(pend,[0,-j*6.5,.5],[2.7,.65,.5],MAT.brass);
  const bob=group(pend,[0,-103,0]);mesh(G.lathe([[.001,-4],[3.2,-4],[5.3,-3.5],[7.9,-1.4],[8.4,0],[7.9,1.4],[5.3,3.5],[3.2,4],[.001,4]],96),MAT.brass,bob);
  ring(bob,8.46,8.12,.75,MAT.edge);ring(bob,3.2,2.85,.25,MAT.darkGold,[0,0,4.03]);cylinder(bob,[0,0,4.3],1.15,.6,MAT.iron);
  ring(bob,1.2,.91,.2,MAT.gold,[0,0,4.65]);box(pend,[0,-112,0],[1.2,3.8,1.4],MAT.iron);
  // Deep architecture. Each stratum disappears into atmospheric perspective.
  const distant=group(root,[-18,21,-142],[.08,-.12,-.2]);
  const farRing=rotor(distant,[0,0,0],[0,0,0],-.004);
  mesh(G.annulus(82,77,5.5,192,.3,164),MAT.iron,farRing,[0,0,0],[0,0,0],[1,1,1],1);
  ring(farRing,78.0,77.6,.4,MAT.brass,[0,0,3],[0,0,0],1);radial(farRing,60,79.8,2.2,.35,.2,3,MAT.steel,0,1);
  for(let i=0;i<9;i++){
   const x=(rng()-.5)*220,y=(rng()-.5)*180,z=-115-rng()*210,r=13+rng()*29;
   gear(root,[x,y,z],r,Math.round(r*3),((i%2)?-1:1)*(.003+rng()*.006),{depth:4,spokes:6+i%4,mat:i%2?MAT.iron:MAT.darkGold,rotation:[rng()*.4,rng()*.7-.35,rng()*TAU],shaft:35,tier:2});
  }
  // Long transmission shafts, collars, and load-bearing ribs.
  for(const [x,z]of[[-112,-70],[-82,-103],[112,-100],[149,-148],[-155,-185],[55,-187]]){
   const pillar=group(root,[x,0,z]);
   cylinder(pillar,[0,5,0],1.5,260,MAT.iron,[Math.PI/2,0,0],1);
   for(const ox of[-2.6,2.6])cylinder(pillar,[ox,5,.3],.32,260,MAT.titanium,[Math.PI/2,0,0],1);
   for(let y=-100;y<=120;y+=22){cylinder(pillar,[0,y,0],2.5,1.3,MAT.darkGold,[Math.PI/2,0,0],1);box(pillar,[0,y,2.6],[.16,.7,.18],MAT.dimLight,[0,0,0],1);}
  }
  box(root,[-30,78,-17],[170,3.8,6],MAT.iron);box(root,[-30,80.2,-13.7],[170,.22,.35],MAT.brass);
  box(root,[0,-94,-55],[290,5,7],MAT.iron);box(root,[-100,0,-90],[4,210,6],MAT.iron);
  // Service galleries. Tiny rails and lamps make the mechanism feel inhabited in the past.
  function gallery(x,y,z,length,tier=0){
   const p=group(root,[x,y,z]);box(p,[0,0,0],[length,.55,2.2],MAT.iron,[0,0,0],tier);
   for(const side of[-1.03,1.03]){
    box(p,[0,.88,side],[length,.075,.075],MAT.titanium,[0,0,0],tier);
    box(p,[0,.40,side],[length,.045,.045],MAT.iron,[0,0,0],tier);
    for(let i=-length/2;i<=length/2;i+=2.3)box(p,[i,.46,side],[.07,1.2,.07],MAT.titanium,[0,0,0],tier);
   }
   for(let i=-length/2;i<length/2;i+=7.3){box(p,[i,-1.35,0],[.2,2.7,2],MAT.iron,[0,0,.55],tier);box(p,[i,.18,1.2],[.14,.12,.1],MAT.light,[0,0,0],tier);}
  }
  gallery(15,-47,41,88);gallery(79,-7,-29,56);gallery(-35,54,-50,96,1);gallery(-60,-19,-115,70,1);
  // Counterweight stacks and housing detail beside the near transmission.
  for(let i=0;i<6;i++){
   cylinder(root,[102,10-i*3.7,-6],4.3,2.7,i%2?MAT.iron:MAT.brass,[Math.PI/2,0,0]);
   cylinder(root,[102,13,-6],.5,62,MAT.steel,[Math.PI/2,0,0]);
  }
  root.update();
  function update(t){
   for(const r of rotors){r.node.rotation[r.axis]=r.phase+t*r.speed;r.node.refresh();}
   for(const p of pendulums){p.node.rotation[2]=Math.sin(t*p.frequency+p.phase)*p.amplitude;p.node.refresh();}
   root.update();
  }
  return {root,meshes,rotors,pendulums,gearCount,update,materials:MAT,centre,metadata:{title:'AION',seed:1771,views:3}};
 }
 A.createWorld=createWorld;A.material=material;
})();
