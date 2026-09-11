/* A compact WebGL 2 renderer: instancing, shadow mapping, HDR bloom and film grain. */
'use strict';
(() => {
 const A=window.AION,{mm,lookAt,ortho,seeded}=A.M;
 class Renderer {
  constructor(canvas){
   this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
   if(!this.gl)throw new Error('WebGL 2 を使用できません。Safari / Chrome の通常のブラウザで開いてください。');
   const gl=this.gl,S=A.Shaders;this.hdr=!!gl.getExtension('EXT_color_buffer_float');this.frame=0;this.batches=[];this.targets=[];this.quality='standard';
   this.programs={mesh:this.program(S.meshVS,S.meshFS),shadow:this.program(S.shadowVS,S.shadowFS),sky:this.program(S.screenVS,S.skyFS),bloom:this.program(S.screenVS,S.bloomFS),post:this.program(S.screenVS,S.postFS),dust:this.program(S.dustVS,S.dustFS)};
   this.emptyVAO=gl.createVertexArray();this.lightVP=mm(ortho(-145,145,-145,145,1,540),lookAt([-128,178,156],[13,0,-32]));
   this.initDust();this.shadowSize=0;this.shadowNeedsUpdate=true;this.setQuality('standard');
  }
  program(vs,fs){
   const gl=this.gl,shaders=[];const p=gl.createProgram();
   for(const [kind,source]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
    const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);gl.deleteProgram(p);throw new Error('描画シェーダーを初期化できません: '+error);}
    gl.attachShader(p,s);shaders.push(s);
   }
   gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
   shaders.forEach(s=>gl.deleteShader(s));return {p,uniforms:new Map()};
  }
  uniform(p,name,type,value){
   const gl=this.gl;if(!p.uniforms.has(name))p.uniforms.set(name,gl.getUniformLocation(p.p,name));const u=p.uniforms.get(name);if(u===null)return;
   if(type==='m')gl.uniformMatrix4fv(u,false,value);else if(type==='v3')gl.uniform3fv(u,value);else if(type==='v2')gl.uniform2fv(u,value);else if(type==='i')gl.uniform1i(u,value);else gl.uniform1f(u,value);
  }
  texture(width,height,depth=false){
   const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
   if(depth)gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,width,height,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
   else gl.texImage2D(gl.TEXTURE_2D,0,this.hdr?gl.RGBA16F:gl.RGBA8,width,height,0,gl.RGBA,this.hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,depth?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,depth?gl.NEAREST:gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;
  }
  target(w,h,withDepth=false){
   const gl=this.gl,fbo=gl.createFramebuffer(),color=this.texture(w,h);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);
   let depth=null;if(withDepth){depth=this.texture(w,h,true);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);}
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('描画バッファを作成できません。');
   const result={w,h,fbo,color,depth};this.targets.push(result);return result;
  }
  makeShadow(size){
   if(this.shadowSize===size)return;const gl=this.gl;
   if(this.shadow){gl.deleteFramebuffer(this.shadow.fbo);gl.deleteTexture(this.shadow.depth);}
   const fbo=gl.createFramebuffer(),depth=this.texture(size,size,true);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('影の描画バッファを作成できません。');
   this.shadow={fbo,depth};this.shadowSize=size;this.shadowNeedsUpdate=true;
  }
  setQuality(q){
   if(!['low','standard','high'].includes(q))q='standard';this.quality=q;
   this.pixelCap=q==='low'?1:q==='high'?1.8:1.25;this.maxPixels=q==='low'?850000:q==='high'?3200000:1800000;
   this.makeShadow(q==='low'?1024:2048);this.resize(true);
  }
  resize(force=false){
   const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
   let ratio=Math.min(window.devicePixelRatio||1,this.pixelCap);ratio=Math.min(ratio,Math.sqrt(this.maxPixels/(w*h)));
   const rw=Math.max(1,Math.round(w*ratio)),rh=Math.max(1,Math.round(h*ratio));
   if(!force&&rw===this.canvas.width&&rh===this.canvas.height)return;
   const gl=this.gl;this.canvas.width=rw;this.canvas.height=rh;this.ratio=ratio;
   for(const t of this.targets){gl.deleteTexture(t.color);if(t.depth)gl.deleteTexture(t.depth);gl.deleteFramebuffer(t.fbo);}this.targets=[];
   this.sceneTarget=this.target(rw,rh,true);this.bloomA=this.target(Math.max(1,rw>>2),Math.max(1,rh>>2));this.bloomB=this.target(Math.max(1,rw>>2),Math.max(1,rh>>2));gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  build(meshes){
   const gl=this.gl;this.batches=[];const groups=new Map();
   for(const mesh of meshes){if(!groups.has(mesh.geometry))groups.set(mesh.geometry,[]);groups.get(mesh.geometry).push(mesh);}
   for(const [geo,nodes]of groups){
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,geo,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    const instance=gl.createBuffer(),data=new Float32Array(nodes.length*24);gl.bindBuffer(gl.ARRAY_BUFFER,instance);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
    for(let i=0;i<4;i++){gl.enableVertexAttribArray(2+i);gl.vertexAttribPointer(2+i,4,gl.FLOAT,false,96,i*16);gl.vertexAttribDivisor(2+i,1);}
    for(let i=0;i<2;i++){gl.enableVertexAttribArray(6+i);gl.vertexAttribPointer(6+i,4,gl.FLOAT,false,96,64+i*16);gl.vertexAttribDivisor(6+i,1);}
    this.batches.push({vao,vbo,instance,data,nodes,count:geo.length/6,active:0});
   }
   gl.bindVertexArray(null);this.shadowNeedsUpdate=true;
  }
  updateInstances(){
   const gl=this.gl,maxTier=this.quality==='low'?1:2;
   for(const b of this.batches){let n=0;for(const node of b.nodes){if(!node.visible||node.tier>maxTier)continue;const i=n*24;b.data.set(node.world,i);b.data.set(node.material,i+16);n++;}b.active=n;gl.bindBuffer(gl.ARRAY_BUFFER,b.instance);gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data,0,n*24);}
  }
  initDust(){
   const gl=this.gl,rand=seeded(419),data=new Float32Array(1400*4);for(let i=0;i<1400;i++){data[i*4]=(rand()-.5)*430;data[i*4+1]=(rand()-.5)*240;data[i*4+2]=rand()*360-260;data[i*4+3]=rand();}
   this.dustVAO=gl.createVertexArray();gl.bindVertexArray(this.dustVAO);this.dustBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.dustBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,4,gl.FLOAT,false,16,0);gl.bindVertexArray(null);
  }
  drawMeshes(){const gl=this.gl;for(const b of this.batches)if(b.active){gl.bindVertexArray(b.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,b.count,b.active);}}
  bindTexture(p,name,texture,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);this.uniform(p,name,'i',unit);}
  blur(source,dest,direction,extract){
   const gl=this.gl,p=this.programs.bloom;gl.bindFramebuffer(gl.FRAMEBUFFER,dest.fbo);gl.viewport(0,0,dest.w,dest.h);gl.useProgram(p.p);this.bindTexture(p,'uTexture',source,0);this.uniform(p,'uDirection','v2',direction);this.uniform(p,'uExtract','i',extract);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  render(camera,time,moving=true){
   const gl=this.gl;this.frame++;
   this.updateInstances();
   if(this.shadowNeedsUpdate||(moving&&this.frame%3===0)){
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.shadow.fbo);gl.viewport(0,0,this.shadowSize,this.shadowSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.5,2.);gl.clear(gl.DEPTH_BUFFER_BIT);
    const p=this.programs.shadow;gl.useProgram(p.p);this.uniform(p,'uLightVP','m',this.lightVP);this.drawMeshes();gl.disable(gl.POLYGON_OFFSET_FILL);this.shadowNeedsUpdate=false;
   }
   const target=this.sceneTarget;gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);gl.viewport(0,0,target.w,target.h);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.depthMask(true);gl.clearColor(.01,.015,.016,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   let p=this.programs.sky;gl.useProgram(p.p);gl.bindVertexArray(this.emptyVAO);this.uniform(p,'uTime','f',time);this.uniform(p,'uAspect','f',target.w/target.h);gl.drawArrays(gl.TRIANGLES,0,3);
   gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);p=this.programs.mesh;gl.useProgram(p.p);this.uniform(p,'uVP','m',camera.vp);this.uniform(p,'uLightVP','m',this.lightVP);this.uniform(p,'uEye','v3',camera.eye);this.uniform(p,'uFog','f',.0041);this.uniform(p,'uShadowTexel','f',1/this.shadowSize);this.bindTexture(p,'uShadow',this.shadow.depth,0);this.drawMeshes();
   p=this.programs.dust;gl.useProgram(p.p);this.uniform(p,'uVP','m',camera.vp);this.uniform(p,'uEye','v3',camera.eye);this.uniform(p,'uTime','f',time);this.uniform(p,'uRatio','f',this.ratio);gl.bindVertexArray(this.dustVAO);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,this.quality==='low'?650:1400);gl.depthMask(true);gl.disable(gl.BLEND);
   gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(this.emptyVAO);
   this.blur(target.color,this.bloomA,[1.5/target.w,0],1);this.blur(this.bloomA.color,this.bloomB,[0,1.6/this.bloomB.h],0);
   if(this.quality==='high'){this.blur(this.bloomB.color,this.bloomA,[1.5/this.bloomA.w,0],0);this.blur(this.bloomA.color,this.bloomB,[0,1.5/this.bloomB.h],0);}
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,target.w,target.h);p=this.programs.post;gl.useProgram(p.p);this.bindTexture(p,'uTexture',target.color,0);this.bindTexture(p,'uBloom',this.bloomB.color,1);this.uniform(p,'uTime','f',time);this.uniform(p,'uResolution','v2',[target.w,target.h]);this.uniform(p,'uBloomStrength','f',.16);this.uniform(p,'uAA','i',this.quality==='low'?0:1);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  stats(){return {batches:this.batches.length,meshes:this.batches.reduce((n,b)=>n+b.active,0),triangles:this.batches.reduce((n,b)=>n+b.count/3*b.active,0),resolution:[this.canvas.width,this.canvas.height],hdr:this.hdr,quality:this.quality,frames:this.frame};}
  dispose(){const gl=this.gl;for(const b of this.batches){gl.deleteBuffer(b.vbo);gl.deleteBuffer(b.instance);gl.deleteVertexArray(b.vao);}for(const p of Object.values(this.programs))gl.deleteProgram(p.p);for(const t of this.targets){gl.deleteTexture(t.color);gl.deleteTexture(t.depth);gl.deleteFramebuffer(t.fbo);}gl.deleteTexture(this.shadow.depth);gl.deleteFramebuffer(this.shadow.fbo);gl.deleteBuffer(this.dustBuffer);gl.deleteVertexArray(this.dustVAO);gl.deleteVertexArray(this.emptyVAO);}
 }
 A.Renderer=Renderer;
})();
