/* All meshes are constructed procedurally. Geometry faces are genuinely 3D. */
'use strict';
(() => {
 const A=window.AION,{TAU,sub,cross,norm}=A.M;
 const cache=new Map();
 function builder(){
  const out=[];
  const vertex=(p,n)=>out.push(...p,...n);
  const tri=(a,b,c,n)=>{n=n||norm(cross(sub(b,a),sub(c,a)));vertex(a,n);vertex(b,n);vertex(c,n);};
  const quad=(a,b,c,d,n)=>{tri(a,b,c,n);tri(a,c,d,n);};
  return {tri,quad,finish:()=>new Float32Array(out)};
 }
 function annulus(ro,ri,depth,segments=128,bevel=0.12,teeth=0) {
  const key=['ring',ro,ri,depth,segments,bevel,teeth].join(':');if(cache.has(key))return cache.get(key);
  const g=builder(),n=teeth?teeth*6:segments,z=depth/2,b=Math.min(bevel,depth*.38,(ro-ri)*.3);
  const outline=[];
  for(let i=0;i<n;i++){
   let angle=TAU*i/n,rad=ro;
   if(teeth){const k=i%6,phase=[-.5,-.34,-.22,.22,.34,.5][k];angle=(Math.floor(i/6)+phase)*TAU/teeth;rad=ro+([-1,-1,1,1,-1,-1][k])*(TAU*ro/teeth)*.23;}
   outline.push([angle,rad]);
  }
  const pt=(a,r,h)=>[Math.cos(a)*r,Math.sin(a)*r,h];
  for(let i=0;i<n;i++){
   const [a,r]=outline[i],[aa,rr]=outline[(i+1)%n];
   const stages=[[ri,ri,-z+b],[ri+b,ri+b,-z],[r-b,rr-b,-z],[r,rr,-z+b],[r,rr,z-b],[r-b,rr-b,z],[ri+b,ri+b,z],[ri,ri,z-b]];
   for(let k=0;k<8;k++){
    const u=stages[k],v=stages[(k+1)%8];
    g.quad(pt(a,u[0],u[2]),pt(aa,u[1],u[2]),pt(aa,v[1],v[2]),pt(a,v[0],v[2]));
   }
  }
  const mesh=g.finish();cache.set(key,mesh);return mesh;
 }
 function box(){
  if(cache.has('box'))return cache.get('box');const g=builder();
  const face=(a,b,c,d)=>g.quad(a,b,c,d);
  face([-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]);
  face([.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]);
  face([.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]);
  face([-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]);
  face([-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]);
  face([-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]);
  const mesh=g.finish();cache.set('box',mesh);return mesh;
 }
 function lathe(profile,segments=64){
  const key=JSON.stringify(['lathe',profile,segments]);if(cache.has(key))return cache.get(key);
  const g=builder();
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
   const a=i*TAU/segments,b=(i+1)*TAU/segments,[r,z]=profile[j],[rr,zz]=profile[j+1];
   const p=(angle,rad,dep)=>[Math.cos(angle)*rad,Math.sin(angle)*rad,dep];
   g.quad(p(a,r,z),p(b,r,z),p(b,rr,zz),p(a,rr,zz));
  }
  const mesh=g.finish();cache.set(key,mesh);return mesh;
 }
 function sphere(segments=32,rings=20){
  const key=`sphere:${segments}:${rings}`;if(cache.has(key))return cache.get(key);
  const g=builder(),p=(t,a)=>[Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a)];
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
   const a=i*TAU/segments,b=(i+1)*TAU/segments,t=j*Math.PI/rings,tt=(j+1)*Math.PI/rings;
   g.quad(p(t,a),p(tt,a),p(tt,b),p(t,b));
  }
  const mesh=g.finish();cache.set(key,mesh);return mesh;
 }
 A.Geo={annulus,box,lathe,sphere};
})();
(() => {
 const A=window.AION,{norm,cross,sub}=A.M;
 A.Geo.prism=(points,depth)=>{
  const a=[];const tri=(p,q,r,n)=>{n=n||norm(cross(sub(q,p),sub(r,p)));for(const v of [p,q,r])a.push(...v,...n);};
  const at=(i,z)=>[...points[i],z];
  for(let i=1;i<points.length-1;i++){tri(at(0,depth/2),at(i,depth/2),at(i+1,depth/2));tri(at(0,-depth/2),at(i+1,-depth/2),at(i,-depth/2));}
  for(let i=0;i<points.length;i++){const j=(i+1)%points.length;tri(at(i,-depth/2),at(j,-depth/2),at(j,depth/2));tri(at(i,-depth/2),at(j,depth/2),at(i,depth/2));}
  return new Float32Array(a);
 };
})();
