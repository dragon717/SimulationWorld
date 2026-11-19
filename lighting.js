import * as THREE from 'three';

// Upper-left clerestory relative to the home camera; all direct reflections use this same light.
const windowDirection = new THREE.Vector3(-0.89, 0.82, -0.39).normalize();
const windowLongitude = (0.63671875 - 0.5) * Math.PI * 2;
const rotation = windowLongitude - Math.atan2(windowDirection.z, windowDirection.x);

export const hallReflection = `
  uniform sampler2D hallRadiance;
  uniform float hallGain, hallYaw;
  uniform vec3 hallAtlas;
  #ifndef ENVMAP_TYPE_CUBE_UV
    #define ENVMAP_TYPE_CUBE_UV
    #define CUBEUV_TEXEL_WIDTH hallAtlas.x
    #define CUBEUV_TEXEL_HEIGHT hallAtlas.y
    #define CUBEUV_MAX_MIP hallAtlas.z
  #endif
  #include <cube_uv_reflection_fragment>
  vec3 hall(vec3 reflected,float roughness){
    float c=cos(hallYaw),s=sin(hallYaw);
    reflected.xz=mat2(c,s,-s,c)*reflected.xz;
    return textureCubeUV(hallRadiance,reflected,roughness).rgb*hallGain;
  }`;

export function daylight(scene, width, depth, probe, live) {
  const span = Math.max(width, depth);
  const sky = new THREE.HemisphereLight(0xc4dff3, 0x8e826c, 1.24);
  const key = new THREE.DirectionalLight(0xffdfb5, 3.1);
  key.position.copy(windowDirection).multiplyScalar(span * 1.75);
  key.castShadow = true;
  const cam = key.shadow.camera;
  cam.left = cam.bottom = -span * 0.78;
  cam.right = cam.top = span * 0.78;
  cam.near = span * 0.2;
  cam.far = span * 3.2;
  cam.updateProjectionMatrix();
  const resolution = live ? 1536 : 2048;
  key.shadow.mapSize.set(resolution, resolution);
  key.shadow.autoUpdate = !live;
  key.shadow.needsUpdate = true;
  let age = Infinity;
  const previousEye = new THREE.Vector3(Infinity, Infinity, Infinity);

  key.shadow.bias = -0.000085;
  key.shadow.normalBias = live ? 0.02 : 0.006;
  const bounce = new THREE.DirectionalLight(0xdbe8ee, 0.36);
  bounce.position.set(0.64, 0.34, 0.85);
  scene.add(sky, key, bounce);
  let near;
  if (live) {
    near = new THREE.DirectionalLight(0xffffff, 0);
    near.castShadow = true;
    near.shadow.autoUpdate = false;
    near.shadow.mapSize.set(1024, 1024);
    Object.assign(near.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.1, far: 100 });
    near.shadow.camera.updateProjectionMatrix();
    near.shadow.bias = -0.00006;
    near.shadow.normalBias = 0.007;
    near.position.copy(windowDirection).multiplyScalar(45);
    scene.add(near, near.target);
  }
  const right = new THREE.Vector3(windowDirection.z, 0, -windowDirection.x).normalize();
  const vertical = windowDirection.clone().cross(right),
    snapped = new THREE.Vector3();

  probe.mapping = THREE.CubeUVReflectionMapping;
  probe.generateMipmaps = false;
  probe.minFilter = THREE.LinearFilter;
  scene.environment = probe;
  scene.environmentRotation.y = rotation;

  const reflection = {
    hallRadiance: { value: probe },
    hallAtlas: {
      value: new THREE.Vector3(1 / probe.image.width, 1 / probe.image.height, Math.log2(probe.image.height) - 2),
    },
    hallGain: { value: 0.45 },
    hallYaw: { value: rotation },
  };
  const drift = new THREE.Vector4(0, 0, 0, 0);
  scene.userData.cloudShadow = drift;
  let cloud = 0,
    desired = 0;
  function apply() {
    key.intensity = 3.35 - 1.65 * cloud;
    drift.w = 0.28 + 0.67 * cloud;
    sky.intensity = 1.2 + 0.58 * cloud;
    key.color.set(0xffdbac).lerp(overcast, cloud * 0.85);
    scene.environmentIntensity = 0.38 + 0.16 * cloud;
    reflection.hallGain.value = 0.52 + 0.14 * cloud;
  }
  const overcast = new THREE.Color(0xf0f3f4);
  apply();
  return {
    reflection,
    cloud: drift,
    weather(rain, immediate = false) {
      desired = THREE.MathUtils.smoothstep(rain, 0.6, 5.5);
      if (immediate) {
        cloud = desired;
        apply();
      }
    },
    invalidate() {
      key.shadow.needsUpdate = true;
    },
    focus(camera, target) {
      if (!near) return;
      if (age >= 1 / 45 || previousEye.distanceToSquared(camera.position) > 1) {
        key.shadow.needsUpdate = true;
        age = 0;
        previousEye.copy(camera.position);
      }
      const weight = 1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(target), 22, 37);
      near.shadow.intensity = weight;
      if (weight <= 0) return;
      const texel = 20 / near.shadow.mapSize.x;
      snapped
        .copy(target)
        .addScaledVector(right, Math.round(target.dot(right) / texel) * texel - target.dot(right))
        .addScaledVector(vertical, Math.round(target.dot(vertical) / texel) * texel - target.dot(vertical));
      near.target.position.copy(snapped);
      near.position.copy(snapped).addScaledVector(windowDirection, 45);
      near.shadow.needsUpdate = true;
    },
    frame(dt, wind, reduced) {
      age += Math.max(0, dt);
      if (!reduced && wind) {
        const u = wind.uniforms,
          travel = Math.min(dt, 0.08) * u.windGust.value * 0.25;
        drift.x += travel * u.windDir.value.x;
        drift.y += travel * u.windDir.value.y;
      }
      if (Math.abs(cloud - desired) < 0.0001) return;
      cloud = THREE.MathUtils.damp(cloud, desired, 1.6, Math.min(0.1, dt));
      apply();
    },
  };
}

export function caseGlass(reflection) {
  return new THREE.ShaderMaterial({
    uniforms: { ...reflection, caseFade: { value: 1 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec3 worldN,worldP;
      void main(){worldN=normalize(mat3(modelMatrix)*normal);vec4 p=modelMatrix*vec4(position,1.);
        worldP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `
      #include <common>
      ${hallReflection}
      varying vec3 worldN,worldP;uniform float caseFade;
      void main(){
        vec3 eye=normalize(cameraPosition-worldP),n=normalize(worldN);
        float f=.04+.96*pow(1.-clamp(dot(n,eye),0.,1.),5.);
        vec3 reflected=hall(reflect(-eye,n),.14);
        gl_FragColor=vec4(reflected+vec3(.014,.028,.026),caseFade*min(.28,f));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// The second light is a local depth capture with zero emitted light. Blend the two
// occlusion measurements at its edge so the sun is applied exactly once.
const shadowCall = (i, intensity) =>
  `getShadow(directionalShadowMap[${i}],directionalLightShadows[${i}].shadowMapSize,${intensity},directionalLightShadows[${i}].shadowBias,directionalLightShadows[${i}].shadowRadius,vDirectionalShadowCoord[${i}])`;
const visibility = `
uniform vec4 cloudField;
float exhibitVisibility(){
#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
  if(!receiveShadow)return 1.;
  vec2 p=(vDirectionalShadowCoord[0].xy-.5)*18.-cloudField.xy;
  float cover=smoothstep(-.65,.64,.55*sin(p.x+.42*sin(p.y))+.40*cos(p.y*1.43-p.x*.63)+.23*sin(dot(p,vec2(2.3,1.8))));
  float transmission=exp2(-cloudField.w*cover);
  float wide=${shadowCall(0, 'directionalLightShadows[0].shadowIntensity')};
  #if NUM_DIR_LIGHT_SHADOWS > 1
    vec3 q=vDirectionalShadowCoord[1].xyz/vDirectionalShadowCoord[1].w;
    float border=min(min(q.x,q.y),min(1.-q.x,1.-q.y));
    float w=directionalLightShadows[1].shadowIntensity*smoothstep(.0,.12,border);
    if(w>0. && q.z>0. && q.z<1.)return transmission*mix(wide,${shadowCall(1, '1.')},w);
  #endif
  return transmission*wide;
#else
  return 1.;
#endif
}`;
const wrapped = new WeakMap();
export function receiveDaylight(mat, cloud) {
  if (wrapped.has(mat)) {
    if (cloud) wrapped.get(mat).value = cloud;
    return mat;
  }
  const cookie = { value: cloud ?? new THREE.Vector4(0, 0, 0, 0) };
  wrapped.set(mat, cookie);
  const previous = mat.onBeforeCompile,
    program = mat.customProgramCacheKey.bind(mat);
  const priorKey = program();
  mat.customProgramCacheKey = () => priorKey + ' exhibit-shadow';
  mat.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.cloudField = cookie;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n' + visibility)
      .replace(
        '#include <lights_fragment_begin>',
        THREE.ShaderChunk.lights_fragment_begin.replace(
          /getShadow\( directionalShadowMap\[ i \][^;]*?vDirectionalShadowCoord\[ i \] \)/g,
          '(UNROLLED_LOOP_INDEX == 0 ? exhibitVisibility() : 1.0)',
        ),
      )
      .replace('#include <shadowmask_pars_fragment>', 'float getShadowMask(){return exhibitVisibility();}');
  };
  return mat;
}

export function groundRelief(mat, detail) {
  const previous = mat.onBeforeCompile,
    key = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => key + ' measured-soil';
  mat.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.groundScan = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 soilAt;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nsoilAt=(modelMatrix*vec4(transformed,1.)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 soilAt;uniform sampler2D groundScan;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec4 fineSoil=texture2D(groundScan,soilAt.xz*.50);
        vec4 strata=texture2D(groundScan,mat2(.8,-.6,.6,.8)*soilAt.xz*.085);
        float vegetation=smoothstep(-.02,.42,soilAt.y);
        diffuseColor.rgb*=mix(.67,1.34,fineSoil.b)*mix(.80,1.20,strata.b);
        diffuseColor.rgb*=mix(vec3(1.04,.97,.86),vec3(.86,1.05,.88),vegetation*(.28+.72*clamp((strata.a-.251)/.749,0.,1.)));
      `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec2 relief=(fineSoil.rg*2.-1.)*.36;
        normal=normalize(normal+mat3(viewMatrix)*vec3(relief.x,0.,relief.y));
      `,
      );
  };
  return mat;
}
