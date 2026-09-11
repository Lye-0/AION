'use strict';
(() => {
const A=window.AION;
const meshVS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in mat4 aModel;
layout(location=6) in vec4 aColor;
layout(location=7) in vec4 aSurface;
uniform mat4 uVP, uLightVP;
uniform vec3 uEye;
out vec3 vWorld,vNormal,vView;
out vec4 vColor,vSurface,vShadow;
void main(){
 vec4 p=aModel*vec4(aPosition,1.);mat3 m=mat3(aModel);
 vNormal=normalize(cross(m[1],m[2])*aNormal.x+cross(m[2],m[0])*aNormal.y+cross(m[0],m[1])*aNormal.z);
 vWorld=p.xyz;vView=uEye-p.xyz;vColor=aColor;vSurface=aSurface;vShadow=uLightVP*p;
 gl_Position=uVP*p;
}`;
const meshFS=`#version 300 es
precision highp float;
in vec3 vWorld,vNormal,vView;
in vec4 vColor,vSurface,vShadow;
uniform sampler2D uShadow;
uniform float uShadowTexel,uFog;
out vec4 fragColor;
const float PI=3.14159265359;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float shadow(vec3 N,vec3 L){
 vec3 p=vShadow.xyz/vShadow.w*.5+.5;
 if(p.z>1.||p.z<0.||p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;
 float bias=max(.0005*(1.-dot(N,L)),.00015),s=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)s+=p.z-bias<=texture(uShadow,p.xy+vec2(float(x),float(y))*uShadowTexel).r?1.:0.;
 return s/9.;
}
vec3 fresnel(float h,vec3 f){return f+(1.-f)*pow(clamp(1.-h,0.,1.),5.);}
vec3 light(vec3 N,vec3 V,vec3 L,vec3 radiance,vec3 albedo,float metal,float rough){
 vec3 H=normalize(V+L);float nv=max(dot(N,V),.001),nl=max(dot(N,L),0.),nh=max(dot(N,H),0.),hv=max(dot(H,V),0.);
 float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.)+1.;float D=a2/(PI*d*d+.0001);
 float k=(rough+1.)*(rough+1.)/8.;float G=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));
 vec3 F=fresnel(hv,mix(vec3(.045),albedo,metal));vec3 spec=D*G*F/(4.*nv*nl+.001);
 return ((1.-F)*(1.-metal)*albedo/PI+spec)*radiance*nl;
}
void main(){
 vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;
 vec3 V=normalize(vView),R=reflect(-V,N);
 float micro=hash(floor(vWorld*12.)),brush=sin(vWorld.z*170.+sin(vWorld.x*4.))*sin(vWorld.y*56.);
 vec3 albedo=vColor.rgb*(.96+.045*micro+.008*brush);
 float rough=clamp(vSurface.x+(micro-.5)*.026,.16,.92),metal=vColor.a;
 vec3 L=normalize(vec3(-.48,.76,.72));float sh=shadow(N,L);
 vec3 c=light(N,V,L,vec3(5.2,4.7,3.85),albedo,metal,rough)*mix(.2,1.,sh);
 c+=light(N,V,normalize(vec3(.8,.16,-.65)),vec3(1.25,1.9,2.35),albedo,metal,rough);
 c+=light(N,V,normalize(vec3(-.1,-.65,.45)),vec3(.48,.36,.23),albedo,metal,rough);
 float sky=.035+.11*smoothstep(-.65,.9,R.y);
 vec3 env=vec3(.53,.65,.7)*sky;
 float strip=pow(max(dot(R,normalize(vec3(-.6,.5,.7))),0.),12./(rough+.25));
 env+=vec3(2.7,2.25,1.7)*strip;
 env+=vec3(.4,.65,.76)*pow(max(dot(R,normalize(vec3(.8,.25,-.5))),0.),6.);
 env+=vec3(.24,.21,.17)*pow(1.-abs(R.y),18.);
 vec3 F=fresnel(max(dot(N,V),0.),mix(vec3(.045),albedo,metal));
 c+=env*F*(1.-rough*.55)*vSurface.z;
 c+=albedo*vec3(.085,.095,.1)*(1.-metal*.6)*(.45+.55*max(N.y,0.))*vSurface.z;
 c+=vColor.rgb*vSurface.y;
 float d=length(vView),fog=1.-exp(-max(d-38.,0.)*uFog);
 vec3 fogColor=mix(vec3(.019,.026,.029),vec3(.039,.042,.038),clamp(vWorld.y*.004+.4,0.,1.));
 c=mix(c,fogColor,fog);
 fragColor=vec4(c,1.);
}`;
const shadowVS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=2) in mat4 aModel;
uniform mat4 uLightVP;
void main(){gl_Position=uLightVP*aModel*vec4(aPosition,1.);}`;
const shadowFS=`#version 300 es
precision highp float;
void main(){}`;
const screenVS=`#version 300 es
precision highp float;
out vec2 vUv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const skyFS=`#version 300 es
precision highp float;
in vec2 vUv;out vec4 fragColor;
uniform float uTime,uAspect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
void main(){
 vec2 p=vUv;float haze=exp(-length((p-vec2(.68,.86))*vec2(.9,1.35))*2.8);
 vec3 c=mix(vec3(.008,.012,.015),vec3(.052,.06,.056),haze*.85);
 float f=noise(p*4.+vec2(uTime*.002,0.))*.5+noise(p*13.-uTime*.003)*.22;
 c+=vec3(.014,.016,.014)*f;
 float ray=0.;for(int i=0;i<3;i++){float x=.53+float(i)*.13;float d=abs(p.x-(x+(1.-p.y)*.27));ray+=exp(-d*d/(.0007+float(i)*.0007));}
 c+=vec3(.042,.037,.025)*ray*smoothstep(.12,1.,p.y)*.38;
 fragColor=vec4(c,1.);
}`;
const bloomFS=`#version 300 es
precision highp float;
in vec2 vUv;out vec4 fragColor;
uniform sampler2D uTexture;
uniform vec2 uDirection;
uniform int uExtract;
vec3 sampleColor(vec2 uv){vec3 c=texture(uTexture,uv).rgb;if(uExtract==1){float b=max(c.r,max(c.g,c.b));c*=smoothstep(.62,1.7,b);}return c;}
void main(){
 vec3 c=sampleColor(vUv)*.227027;
 c+=sampleColor(vUv+uDirection*1.384615)*.316216;c+=sampleColor(vUv-uDirection*1.384615)*.316216;
 c+=sampleColor(vUv+uDirection*3.230769)*.07027;c+=sampleColor(vUv-uDirection*3.230769)*.07027;
 fragColor=vec4(c,1.);
}`;
const postFS=`#version 300 es
precision highp float;
in vec2 vUv;out vec4 fragColor;
uniform sampler2D uTexture,uBloom;
uniform float uTime,uBloomStrength;
uniform int uAA;
uniform vec2 uResolution;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 antialias(vec2 uv){
 vec3 m=texture(uTexture,uv).rgb;if(uAA==0)return m;
 vec2 pixel=1./uResolution;vec3 luma=vec3(.299,.587,.114);
 vec3 nw=texture(uTexture,uv+vec2(-1.,-1.)*pixel).rgb,ne=texture(uTexture,uv+vec2(1.,-1.)*pixel).rgb;
 vec3 sw=texture(uTexture,uv+vec2(-1.,1.)*pixel).rgb,se=texture(uTexture,uv+vec2(1.,1.)*pixel).rgb;
 float lnw=dot(nw,luma),lne=dot(ne,luma),lsw=dot(sw,luma),lse=dot(se,luma),lm=dot(m,luma);
 float low=min(lm,min(min(lnw,lne),min(lsw,lse))),high=max(lm,max(max(lnw,lne),max(lsw,lse)));
 if(high-low<max(.013,high*.08))return m;
 vec2 dir=vec2(-((lnw+lne)-(lsw+lse)),(lnw+lsw)-(lne+lse));
 float reduce=max((lnw+lne+lsw+lse)*.03125,.0078125);dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-6.),vec2(6.))*pixel;
 vec3 a=.5*(texture(uTexture,uv+dir*(1./3.-.5)).rgb+texture(uTexture,uv+dir*(2./3.-.5)).rgb);
 vec3 b=a*.5+.25*(texture(uTexture,uv-dir*.5).rgb+texture(uTexture,uv+dir*.5).rgb);float lb=dot(b,luma);
 return lb<low||lb>high?a:b;
}
void main(){
 vec3 c=antialias(vUv)+texture(uBloom,vUv).rgb*uBloomStrength;
 c=aces(c*1.22);c=pow(c,vec3(1./2.2));
 vec2 q=vUv*(1.-vUv);float vig=pow(clamp(q.x*q.y*18.,0.,1.),.20);c*=mix(.54,1.,vig);
 float grain=hash(vUv*uResolution+fract(uTime)*917.)-.5;c+=grain*.017;
 fragColor=vec4(c,1.);
}`;
const dustVS=`#version 300 es
precision highp float;
layout(location=0)in vec4 aParticle;
uniform mat4 uVP;uniform vec3 uEye;uniform float uTime,uRatio;
out float vAlpha;
void main(){vec3 p=aParticle.xyz;p.x+=sin(uTime*.07+aParticle.w*31.)*1.1;p.y+=sin(uTime*.04+aParticle.w*18.)*1.7;gl_Position=uVP*vec4(p,1.);float d=distance(p,uEye);gl_PointSize=clamp((1.+aParticle.w)*120./d,.6,2.5)*uRatio;vAlpha=exp(-d*.005)*(.1+aParticle.w*.2);}`;
const dustFS=`#version 300 es
precision highp float;in float vAlpha;out vec4 fragColor;
void main(){float a=1.-smoothstep(.03,.5,length(gl_PointCoord-.5));fragColor=vec4(.67,.54,.34,a*vAlpha);}`;
A.Shaders={meshVS,meshFS,shadowVS,shadowFS,screenVS,skyFS,bloomFS,postFS,dustVS,dustFS};
})();
