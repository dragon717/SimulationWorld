// Local +X points towards the muzzle and +Y is up. The mesh role is exported with each vertex.
export function activity(s, a, old, food, last) {
  const i = a.y * s.width + a.x;
  const dx = old ? a.x - old.cellX : 0,
    dz = old ? a.y - old.cellY : 0;
  const wet = (j) => s.terrain[j] === 1 && s.water[j] >= 15;
  if (dx || dz)
    return {
      name: wet(i) && a.species !== 'deer' ? 'swim' : 'walk',
      heading: Math.atan2(-dz, dx),
      distance: Math.hypot(dx, dz),
    };
  if (
    food.has(a.id) ||
    (a.species === 'deer' && old && last && s.grass[i] < last.grass[i] && a.energy > old.energy)
  )
    return { name: 'feed', heading: old?.heading };
  if (old && a.species !== 'crocodile' && !wet(i)) {
    for (const [x, z] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = a.x + x,
        ny = a.y + z;
      if (nx >= 0 && nx < s.width && ny >= 0 && ny < s.height && wet(ny * s.width + nx))
        return { name: 'drink', heading: Math.atan2(-z, x) };
    }
  }
  return { name: 'idle', heading: old?.heading };
}

export const actionNames = { idle: '停留', walk: '移动', swim: '游泳', feed: '进食', drink: '饮水姿态' };
export const channels = ['walk', 'swim', 'feed', 'drink'];

export function samplePlaybackPose(a, t, duration, settle, reduceMotion) {
  const lead = a.remaining,
    edge = a.edgeDistance;
  const stopRange = Math.max(lead, a.previousSpeed * duration);
  let travel = edge ? t * (lead + edge) : Math.min(lead, t * stopRange);
  if (lead && travel < lead) {
    const u = travel / lead;
    // Brake into a sharp corner or stop. Both incident paths still meet at the actual cell.
    travel += lead * u * u * (1 - u) * (edge ? a.entryBrake : 1);
  } else if (edge) {
    const u = (travel - lead) / edge;
    if (u < 0.18) travel -= edge * a.entryBrake * u * (1 - u / 0.18) ** 2;
  }
  if (lead && travel < lead) a.position.lerpVectors(a.from, a.via, travel / lead);
  else a.position.lerpVectors(a.via, a.to, edge ? Math.min(1, (travel - lead) / edge) : 1);

  const turnT = Math.min(1, t / (0.19 + (0.18 * Math.abs(a.turn)) / Math.PI));
  a.facing = a.startFacing + a.turn * turnT * turnT * (3 - 2 * turnT);
  const restT = edge || !lead ? t : Math.max(0, t - lead / stopRange);
  const w = Math.min(1, restT / 0.32),
    blend = w * w * (3 - 2 * w);
  for (let k = 0; k < 4; k++) a.weights[k] = a.startWeights[k] + (a.targetWeights[k] - a.startWeights[k]) * blend;
  a.weights[0] *= settle;
  a.weights[1] *= settle;
  const strides = Math.min(travel, lead) / a.previousStride + Math.max(0, travel - lead) / a.stride;
  const idleCycles = edge || reduceMotion ? 0 : restT * a.restingCycles;
  a.phase = a.startPhase + Math.PI * 2 * (strides + idleCycles);
}

export function animateMaterial(material, species) {
  const kind = species === 'mugger' ? 2 : species === 'tiger' ? 1 : 0;
  material.customProgramCacheKey = () => 'rapti-motion-' + kind;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float _part;
attribute vec4 actions;
attribute float stridePhase;
mat2 turn(float a) {float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
// During stance the foot travels back by the exact distance the root travels forward.
vec2 footfall(float phase,float stride,float lift) {
  float u=fract(phase*.15915494309),stance=.60, excursion=stride*stance;
  if(u<stance)return vec2(excursion*(.5-u/stance),0.);
  float v=(u-stance)/(1.-stance);
  float reach=excursion*(smoothstep(0.,1.,v)-.5)-stride*(1.-stance)*v*(1.-v)*(1.-2.*v);
  float arc=sin(3.14159*v);
  return vec2(reach,lift*arc*arc);
}
void animalPose(inout vec3 p,inout vec3 n) {
  float phase=stridePhase, walk=actions.x, swim=actions.y, feed=actions.z, drink=actions.w;
  float lower=feed+drink, wave=sin(phase), front=step(0.0,p.x);
  float idle=max(0.,1.-walk-swim-lower);
  float chest=smoothstep(.16,.75,p.y)*clamp(1.-abs(p.x-.24),0.,1.);
  p.y+=idle*.012*chest*wave;
  p.z+=idle*.010*chest*sign(p.z)*wave;
  bool leg=_part>0.5 && _part<1.5, head=abs(_part-2.)<.3, jaw=abs(_part-3.)<.3;
  bool tail=abs(_part-4.)<.3,tongue=abs(_part-6.)<.3, lowerJaw=abs(_part-7.)<.3;
  #if ANIMAL == 2
    float axial=smoothstep(.7,2.8,.9-p.x);
    p.z+=swim*axial*.40*sin(phase+2.6*p.x);
    if(leg) {
      float limb=smoothstep(.24,.52,abs(p.z))*(1.-smoothstep(.20,.35,p.y));
      vec2 stepOffset=footfall(phase+3.14159*(front+step(0.,p.z)),.68,.068);
      p.y+=limb*walk*stepOffset.y;
      p.z*=1.-limb*.52*swim;
      p.x+=limb*(walk*stepOffset.x-.12*swim);
    }
    if(jaw) {
      mat2 r=turn(-feed*(.17+.17*wave)); p.xy=vec2(.72,.252)+r*(p.xy-vec2(.72,.252)); n.xy=r*n.xy;
    }
  #else
    float hip=ANIMAL==1?.98:1.02;
    float foot=leg?clamp((hip-p.y)/hip,0.,1.):0.;
    float side=step(0.,p.z);
    float limbPhase=phase+3.14159*side+front*1.43;
    vec2 stepOffset=footfall(limbPhase,1.4,ANIMAL==1?.135:.15);
    p.x+=foot*(walk*stepOffset.x-swim*.32*cos(limbPhase));
    p.y+=foot*(walk*stepOffset.y+swim*(.17+.22*sin(limbPhase)));
    p.z+=foot*sign(p.z)*lower*front*.13;
    float crouch=smoothstep(-.8,.48,p.x)*lower*(ANIMAL==1?.54:.37);
    if(head||tongue||lowerJaw){
      if(lowerJaw){
        vec2 hinge=ANIMAL==1?vec2(.93,.94):vec2(.77,1.49);
        mat2 bite=turn(-(.08+.08*wave)*(feed+drink));
        p.xy=hinge+bite*(p.xy-hinge);n.xy=bite*n.xy;
      }
      vec2 pivot=ANIMAL==1?vec2(.62,.957):vec2(.42,1.035);
      float angle=-(ANIMAL==1?.91:2.16)*lower+.055*feed*wave+.020*drink*wave+.16*swim;
      if(tongue){p.x+=.045*drink*(1.+wave);p.y-=.080*drink*(1.+wave);}
      mat2 r=turn(angle);p.xy=pivot+r*(p.xy-pivot);n.xy=r*n.xy;
      crouch=lower*(ANIMAL==1?.54:.37);
    }
    p.y-=crouch*(1.-foot);
    p.y+=.024*walk*cos(phase*2.)*(1.-foot);
    if(tail) p.z+=(walk+.6*swim)*.13*sin(phase+p.x)*smoothstep(.85,1.75,-p.x);
  #endif
}`.replace('#include <common>', '#include <common>\n#define ANIMAL ' + kind),
      )
      .replace(
        '#include <begin_vertex>',
        material.isMeshDepthMaterial
          ? 'vec3 transformed=position, depthNormal=normal; animalPose(transformed,depthNormal);'
          : 'vec3 transformed=posePoint;',
      )
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvec3 posePoint=position; animalPose(posePoint,objectNormal);',
      );
  };
  return material;
}
