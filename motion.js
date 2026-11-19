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
void animalPose(inout vec3 p,inout vec3 n) {
  float phase=stridePhase, walk=actions.x, swim=actions.y, feed=actions.z, drink=actions.w;
  float lower=feed+drink, wave=sin(phase), front=step(0.0,p.x);
  bool leg=_part>0.5 && _part<1.5, head=abs(_part-2.)<.3, jaw=abs(_part-3.)<.3;
  bool tail=abs(_part-4.)<.3,tongue=abs(_part-6.)<.3, lowerJaw=abs(_part-7.)<.3;
  #if ANIMAL == 2
    float axial=smoothstep(.7,2.8,.9-p.x);
    p.z+=swim*axial*.40*sin(phase+2.6*p.x);
    if(leg) {
      float limb=smoothstep(.24,.52,abs(p.z))*(1.-smoothstep(.20,.35,p.y));
      p.y+=limb*.065*walk*max(0.,cos(phase+3.14159*(front+step(0.,p.z))));
      p.z*=1.-limb*.52*swim;
      p.x+=limb*(.17*walk*sin(phase+3.14159*(front+step(0.,p.z)))-.12*swim);
    }
    if(jaw) {
      mat2 r=turn(-feed*(.17+.17*wave)); p.xy=vec2(.72,.252)+r*(p.xy-vec2(.72,.252)); n.xy=r*n.xy;
    }
  #else
    float hip=ANIMAL==1?.98:1.02;
    float foot=leg?clamp((hip-p.y)/hip,0.,1.):0.;
    float side=step(0.,p.z);
    float limbPhase=phase+3.14159*side+front*1.43;
    p.x-=foot*(walk*.34+swim*.32)*cos(limbPhase);
    p.y+=foot*(walk*.14*max(0.,sin(limbPhase))+swim*(.17+.22*sin(limbPhase)));
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
      .replace('#include <begin_vertex>', 'vec3 transformed=posePoint;')
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvec3 posePoint=position; animalPose(posePoint,objectNormal);',
      );
  };
  return material;
}
