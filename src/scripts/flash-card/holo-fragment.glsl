// Independent GLSL rendition of the layer sizes/motion studied at poke-holo.simey.me.
uniform vec2 uPointer;
uniform float uHover;
uniform sampler2D tSubjectMask;

vec2 backgroundUV(vec2 uv, vec2 size, vec2 position) {
  return (uv-(1.-size)*position)/size;
}
float gradientAt(vec2 uv, vec2 size, float angle) {
  vec2 direction = vec2(sin(angle),-cos(angle));
  vec2 dimensions = size*vec2(uAspect,1.);
  return .5+dot((uv-.5)*dimensions,direction)/dot(abs(direction),dimensions);
}
vec3 rainbowAt(float phase) {
  float p = fract(phase)*6.;
  vec3 a, b;
  if (p<1.) { a=vec3(.76,.40,.85); b=vec3(.94,.37,.36); }
  else if (p<2.) { a=vec3(.94,.37,.36); b=vec3(.94,.82,.29); }
  else if (p<3.) { a=vec3(.94,.82,.29); b=vec3(.54,.80,.30); }
  else if (p<4.) { a=vec3(.54,.80,.30); b=vec3(.28,.73,.69); }
  else if (p<5.) { a=vec3(.28,.73,.69); b=vec3(.48,.60,1.); }
  else { a=vec3(.48,.60,1.); b=vec3(.76,.40,.85); }
  return mix(a,b,fract(p));
}
vec3 dodge(vec3 base, vec3 light) {
  return min(vec3(1.),base/max(vec3(.08),1.-light));
}
vec3 overlay(vec3 base, vec3 light) {
  return mix(2.*base*light,1.-2.*(1.-base)*(1.-light),step(vec3(.5),base));
}
vec3 referenceFoil(vec3 ink) {
  vec2 bg = vec2(.37,.33)+uPointer*vec2(.26,.34);
  float distanceFromCenter = clamp(length(uPointer-.5)*2.,0.,1.);
  vec2 glareUv = (vUv-uPointer)*vec2(uAspect,1.);
  float glare = exp(-dot(glareUv,glareUv)*5.);
  vec3 coated;
  if (uFinish<4.5) {
    vec2 size = vec2(3.,4.);
    vec2 uv = backgroundUV(vUv,size,vec2(0.,bg.y));
    vec3 color = rainbowAt((gradientAt(uv,size,radians(-22.))-.05)/.3);
    coated = dodge(ink,color*(.35+.2*distanceFromCenter));
    coated = mix(coated,overlay(coated,vec3(.4+glare*.5)),.35);
  } else if (uFinish<5.5) {
    vec2 sizeA = vec2(2.,7.), sizeB = vec2(2.,4.);
    vec2 colorA = backgroundUV(vUv,sizeA,vec2(0.,bg.y));
    vec2 colorB = backgroundUV(vUv,sizeB,vec2(0.,bg.y));
    vec3 rainbowA = rainbowAt((1.-colorA.y-.05)/.3);
    vec3 rainbowB = rainbowAt((1.-colorB.y-.05)/.3);
    vec2 position = vec2(bg.x+bg.y*.2,bg.y);
    vec2 beamA = backgroundUV(vUv,vec2(3.,1.),position);
    vec2 beamB = backgroundUV(vUv,vec2(1.95,1.),-position);
    float a = gradientAt(beamA,vec2(3.,1.),radians(133.));
    float b = gradientAt(beamB,vec2(1.95,1.),radians(133.));
    float lineA = 1.-smoothstep(.006,.018+fwidth(a),abs(mod(a,.12)-.045));
    float lineB = 1.-smoothstep(.006,.018+fwidth(b),abs(mod(b,.12)-.045));
    vec3 reflection = rainbowA*(.2+.5*lineA)+rainbowB*(.12+.35*lineB);
    coated = dodge(ink,reflection*.75);
    coated = mix(coated,overlay(coated,rainbowB),.15*lineB);
  } else {
    vec2 size = vec2(4.);
    vec2 uvA = backgroundUV(vUv,size,bg*1.5);
    vec2 uvB = backgroundUV(vUv,size,-bg*1.5);
    vec3 a = rainbowAt(gradientAt(uvA,size,radians(-30.))*3.);
    vec3 b = rainbowAt(gradientAt(uvB,size,radians(-60.))*3.);
    coated = dodge(overlay(ink,mix(vec3(.5),a,.5)),b*.34);
  }
  coated = mix(coated,vec3(1.),glare*.10);
  float amount = uFoil*clamp(uHover,0.,1.);
  if (uFinish<4.5) amount *= 1.-texture2D(tSubjectMask,vUv).r;
  return linearPrint(mix(ink,clamp(coated,0.,1.),amount));
}
