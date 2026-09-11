'use strict';
(() => {
 const A=window.AION,$=id=>document.getElementById(id),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const state={playing:!reduced,speed:1,time:0,view:0,cinema:false,ready:false,quality:'standard',frames:0};
 let renderer,world,camera,audio,raf=0,last=0,toastTimer=0,alive=true,pendingAudio=false,forceRender=true,lastWorldTime=-1,lastClockStamp=-1,lastCameraSignature='';
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);}
 function showError(error){state.ready=false;cancelAnimationFrame(raf);$('loading').classList.add('done');$('error-message').textContent=error instanceof Error?error.message:String(error);$('error-panel').hidden=false;console.error('[AION]',error);}
 function setPlaying(playing){
  state.playing=playing;$('pause').setAttribute('aria-pressed',String(!playing));$('pause').setAttribute('aria-label',playing?'機構の演出を止める':'機構の演出を動かす');$('pause').title=playing?'機構の演出を止める（Space）／時計は現在時刻を維持':'機構の演出を動かす（Space）';
  $('pause-icon').innerHTML=playing?'<path d="M9 5v14M15 5v14"/>':'<path d="m8 4 11 8-11 8V4Z"/>';
  $('status-label').textContent=playing?'MECHANISM ACTIVE':'SCENE PAUSED / CLOCK LIVE';$('status-dot').classList.toggle('paused',!playing);
 }
 function setDrift(on){if(camera)camera.drift=on;$('drift').classList.toggle('active',on);$('drift').setAttribute('aria-pressed',String(on));}
 const descriptions=['終わりを持たない機構。<br>始まりを持たない時間。','ひとつの運動が、<br>世界の奥へと伝わっていく。','行って、帰る。<br>ただそれだけを、永遠に。'];
 function setView(i,immediate=false){
  state.view=i;camera.setPreset(i,immediate);setDrift(!reduced);
  document.querySelectorAll('[data-view]').forEach(b=>{const selected=Number(b.dataset.view)===i;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  $('view-number').textContent=String(i+1).padStart(2,'0');$('view-description').innerHTML=descriptions[i];$('view-coordinate').textContent=A.VIEWS[i].en;$('interaction-hint').style.opacity='1';document.body.dataset.activeView=String(i);
 }
 function setCinema(value){state.cinema=value;document.body.classList.toggle('cinema',value);if(value)$('restore-ui').focus({preventScroll:true});else $('cinema').focus({preventScroll:true});}
 function bindUI(){
  $('pause').addEventListener('click',()=>setPlaying(!state.playing));$('drift').addEventListener('click',()=>setDrift(!camera.drift));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(Number(b.dataset.view))));$('home').addEventListener('click',()=>setView(0));
  $('cinema').addEventListener('click',()=>setCinema(true));$('restore-ui').addEventListener('click',()=>setCinema(false));
  $('sound').addEventListener('click',async()=>{
   if(pendingAudio)return;pendingAudio=true;const button=$('sound');button.disabled=true;
   try{const enabled=await audio.setEnabled(!audio.enabled);button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'環境音をオフにする':'環境音をオンにする');button.title='環境音：'+(enabled?'オン':'オフ');$('sound-waves').setAttribute('d',enabled?'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14':'m16 9 5 6m0-6-5 6');toast(enabled?'低く響く機構の環境音をオンにしました':'環境音をオフにしました');}
   catch(e){toast(e.message||'環境音を再生できませんでした。');}finally{pendingAudio=false;button.disabled=false;}
  });
  $('quality').addEventListener('change',e=>{try{state.quality=e.target.value;renderer.setQuality(state.quality);forceRender=true;try{localStorage.setItem('aion-quality',state.quality);}catch{}}catch(error){showError(error);} });
  document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{state.speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(x=>{const active=x===b;x.classList.toggle('selected',active);x.setAttribute('aria-pressed',String(active));});}));
  for(const name of['about','settings']){
   const d=$(name);$(name+'-open').addEventListener('click',()=>d.showModal());document.querySelector(`[data-close="${name}"]`).addEventListener('click',()=>d.close());
   d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
  }
  document.addEventListener('keydown',e=>{
   if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)&&e.code==='Space')return;
   if(document.querySelector('dialog[open]'))return;
   if(e.code==='Space'){e.preventDefault();setPlaying(!state.playing);}else if(e.key.toLowerCase()==='h'){e.preventDefault();setCinema(!state.cinema);}else if(e.key==='Escape'&&state.cinema)setCinema(false);else if(['1','2','3'].includes(e.key))setView(Number(e.key)-1);
  });
  window.addEventListener('resize',()=>{if(renderer){renderer.resize();forceRender=true;}});
  document.addEventListener('visibilitychange',()=>{last=0;audio.visibility(document.hidden).catch(()=>{});if(document.hidden)cancelAnimationFrame(raf);else if(alive&&state.ready)raf=requestAnimationFrame(loop);});
  $('world').addEventListener('webglcontextlost',e=>{e.preventDefault();showError(new Error('描画コンテキストが一時的に失われました。「もう一度開く」で再開できます。'));});
  $('retry').addEventListener('click',()=>location.reload());
  window.addEventListener('pagehide',e=>{cancelAnimationFrame(raf);audio.visibility(true).catch(()=>{});if(!e.persisted){alive=false;camera.dispose();renderer.dispose();audio.dispose();}});
  window.addEventListener('pageshow',e=>{if(e.persisted&&state.ready){last=0;audio.visibility(false).catch(()=>{});raf=requestAnimationFrame(loop);}});
 }
 function loop(timestamp){
  if(!alive||!state.ready||document.hidden)return;
  const dt=last?Math.min((timestamp-last)/1000,.5):0;last=timestamp;
  if(state.playing)state.time+=dt*state.speed;
  try{
   // Read the wall clock afresh: no accumulated lag, speed scaling or hidden-tab drift.
   const epoch=Date.now(),clockStamp=state.playing?epoch:Math.floor(epoch/1000)*1000;
   if(state.time!==lastWorldTime||clockStamp!==lastClockStamp){
    world.update(state.time,A.Clock.sample(clockStamp));lastWorldTime=state.time;lastClockStamp=clockStamp;forceRender=true;
   }
   camera.update(dt,state.time);const signature=camera.eye.join(',')+';'+camera.target.join(',')+';'+camera.fov;
   if(forceRender||state.playing||signature!==lastCameraSignature){renderer.render(camera,state.time,state.playing||forceRender);lastCameraSignature=signature;forceRender=false;}
   audio.update(state.time,state.playing);
   state.frames++;if(state.frames%12===0){$('continuum').textContent=(state.time/60).toFixed(3).padStart(7,'0');}
   raf=requestAnimationFrame(loop);
  }catch(e){showError(e);}
 }
 async function boot(){
  try{
   $('loading-progress').textContent='08';await nextFrame();renderer=new A.Renderer($('world'));
   $('loading-progress').textContent='32';await nextFrame();world=A.createWorld();renderer.build(world.meshes);
   $('loading-progress').textContent='76';await nextFrame();camera=new A.CameraControls($('world'),()=>{setDrift(false);$('interaction-hint').style.opacity='0';});audio=new A.Soundscape();
   let saved;try{saved=localStorage.getItem('aion-quality');}catch{}if(['low','standard','high'].includes(saved)){state.quality=saved;renderer.setQuality(saved);$('quality').value=saved;}
   bindUI();setPlaying(state.playing);setDrift(!reduced);world.update(0,A.Clock.sample());camera.update(0,0);renderer.render(camera,0);
   $('loading-progress').textContent='100';$('loading-caption').textContent='時間は、すでに流れている。';state.ready=true;document.body.dataset.ready='true';
   Object.defineProperty(window,'__AION_DEBUG__',{get:()=>({...state,render:renderer.stats(),rotorAngles:world.rotors.slice(0,6).map(r=>r.node.rotation[r.axis]),pendulumAngle:world.pendulums[0].node.rotation[2],camera:[...camera.eye],cameraTarget:[...camera.target],cameraDistance:camera.distance,drift:camera.drift,audio:{enabled:audio.enabled,state:audio.ctx?.state||'uninitialized'},assemblies:world.gearCount,
    clock:{...world.clock.sample,minuteAngle:world.clock.minute.rotation[2],hourAngle:world.clock.hour.rotation[2]},
    rearTransmission:{gears:world.transmission.parts.length,meshLinks:world.transmission.links.filter(l=>l.kind==='mesh').length,shafts:world.transmission.links.filter(l=>l.kind==='shaft').length,angles:world.transmission.parts.slice(0,14).map(p=>({id:p.id,angle:p.node.rotation[2],speed:p.speed}))}})});
   await nextFrame();$('loading').classList.add('done');raf=requestAnimationFrame(loop);
  }catch(e){showError(e);$('retry').addEventListener('click',()=>location.reload());}
 }
 boot();
})();
