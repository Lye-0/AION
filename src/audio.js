/* Optional, entirely synthesized ambience. No samples, network requests or autoplay. */
'use strict';
(() => {
 class Soundscape {
  constructor(){this.ctx=null;this.enabled=false;this.lastTick=-1;this.sources=[];this.disposed=false;}
  create(){
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('このブラウザでは環境音を再生できません。');
   const c=this.ctx=new Audio();this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
   const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=430;filter.Q.value=.3;filter.connect(this.master);
   for(const [hz,level]of[[43.65,.13],[65.41,.055],[87.32,.045],[130.81,.018]]){
    const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=hz;g.gain.value=level;o.connect(g);g.connect(filter);o.start();this.sources.push(o);
    const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.07+hz*.0002;lg.gain.value=level*.28;lfo.connect(lg);lg.connect(g.gain);lfo.start();this.sources.push(lfo);
   }
   const buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);let brown=0;
   for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.015)/1.016;data[i]=brown*1.2;}
   const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;const ng=c.createGain();ng.gain.value=.095;noise.connect(ng);ng.connect(filter);noise.start();this.sources.push(noise);
  }
  async setEnabled(on){
   if(on&&!this.ctx)this.create();if(!this.ctx)return false;
   if(on&&this.ctx.state==='suspended')await this.ctx.resume();
   this.enabled=on;this.master.gain.setTargetAtTime(on?.40:0,this.ctx.currentTime,.7);return this.enabled;
  }
  strike(){
   if(!this.ctx||!this.enabled||this.ctx.state!=='running')return;const c=this.ctx,t=c.currentTime;
   for(const [hz,v,d]of[[182,.035,.65],[391,.009,1.5],[677,.005,2.1]]){
    const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(hz*.994,t+.12);g.gain.setValueAtTime(.00001,t);g.gain.exponentialRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.00001,t+d);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+d+.1);o.onended=()=>{o.disconnect();g.disconnect();};
   }
  }
  update(time,playing){const tick=Math.floor(time/4.25);if(tick!==this.lastTick){if(this.lastTick>=0&&playing)this.strike();this.lastTick=tick;}}
  async visibility(hidden){if(!this.ctx||this.disposed)return;if(hidden&&this.ctx.state==='running')await this.ctx.suspend();else if(!hidden&&this.enabled&&this.ctx.state==='suspended')await this.ctx.resume();}
  dispose(){this.disposed=true;this.sources.forEach(s=>{try{s.stop();}catch{}});if(this.ctx)this.ctx.close();}
 }
 window.AION.Soundscape=Soundscape;
})();
