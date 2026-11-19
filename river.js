// Linear shallow-water surface on the visible channel. Distances are in scene metres.
import * as THREE from 'three';

export class WaveField {
  constructor(points, faces, owners) {
    this.points = points;
    this.faces = faces;
    this.owners = owners;
    const n = points.length / 3;
    this.height = new Float32Array(n);
    this.previous = new Float32Array(n);
    this.velocity = new Float32Array(n);
    this.accel = new Float32Array(n);
    this.mass = new Float32Array(n);
    this.depth = new Float32Array(n);
    this.bins = new Map();
    this.windSin = new Float32Array(n);
    this.windCos = new Float32Array(n);
    this.pressure = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const phase = 0.91 * points[i * 3] + 0.52 * points[i * 3 + 2];
      this.windSin[i] = Math.sin(phase);
      this.windCos[i] = Math.cos(phase);
      const key = Math.floor(points[i * 3]) + ',' + Math.floor(points[i * 3 + 2]);
      if (!this.bins.has(key)) this.bins.set(key, []);
      this.bins.get(key).push(i);
    }
    this.clock = 0;
    this.remainder = 0;
  }

  configure(water) {
    const { points: p, faces: f, owners, mass, depth } = this;
    const oldMass = mass.slice();
    mass.fill(0);
    depth.fill(0);
    const edges = new Map(),
      visible = [];
    for (let t = 0; t < owners.length; t++) {
      const amount = water[owners[t]];
      if (amount < 15) continue;
      const a = f[t * 3],
        b = f[t * 3 + 1],
        c = f[t * 3 + 2];
      visible.push(a, b, c);
      const area2 = Math.abs(
        (p[3 * b] - p[3 * a]) * (p[3 * c + 2] - p[3 * a + 2]) -
          (p[3 * b + 2] - p[3 * a + 2]) * (p[3 * c] - p[3 * a]),
      );
      if (area2 < 1e-9) continue;
      for (const i of [a, b, c]) {
        mass[i] += area2 / 6;
        depth[i] += ((area2 / 6) * amount) / 100;
      }
      for (const [i, j, k] of [
        [a, b, c],
        [b, c, a],
        [c, a, b],
      ]) {
        const cot =
          ((p[3 * i] - p[3 * k]) * (p[3 * j] - p[3 * k]) +
            (p[3 * i + 2] - p[3 * k + 2]) * (p[3 * j + 2] - p[3 * k + 2])) /
          area2;
        const key = Math.min(i, j) * mass.length + Math.max(i, j);
        edges.set(key, (edges.get(key) || 0) + cot * 0.5);
      }
    }
    const pairs = [],
      stiffness = [],
      weights = [],
      rates = new Float32Array(mass.length);
    for (let i = 0; i < mass.length; i++) {
      if (mass[i]) depth[i] /= mass[i];
      if (!mass[i] || !oldMass[i]) this.previous[i] = this.height[i] = this.velocity[i] = 0;
    }
    for (const [key, cot] of edges) {
      if (cot <= 1e-6) continue;
      const a = Math.floor(key / mass.length),
        b = key % mass.length;
      const k = 9.81 * (0.08 + 0.34 * Math.min(depth[a], depth[b])) * cot;
      pairs.push(a, b);
      stiffness.push(k);
      weights.push(cot);
      rates[a] += (9.81 * 0.42 * cot) / mass[a];
      rates[b] += (9.81 * 0.42 * cot) / mass[b];
    }
    let maxRate = 1;
    for (const rate of rates) maxRate = Math.max(maxRate, rate);
    this.weights = Float32Array.from(weights);
    this.pairs = Uint32Array.from(pairs);
    this.stiffness = Float32Array.from(stiffness);
    this.dt = Math.min(1 / 30, 0.85 * Math.sqrt(2 / maxRate));
    this.visible = visible;
    return visible;
  }

  disturb(x, z, strength, radius = 0.9) {
    const nodes = [],
      { points: p, mass } = this;
    let total = 0,
      weight = 0;
    for (let iz = Math.floor(z - radius); iz <= Math.floor(z + radius); iz++)
      for (let ix = Math.floor(x - radius); ix <= Math.floor(x + radius); ix++) {
        for (const i of this.bins.get(ix + ',' + iz) ?? []) {
          const r = ((p[3 * i] - x) ** 2 + (p[3 * i + 2] - z) ** 2) / (radius * radius);
          if (!mass[i] || r >= 1) continue;
          const w = (1 - r) ** 3;
          nodes.push(i, w);
          total += mass[i];
          weight += w * mass[i];
        }
      }
    if (!total) return;
    // Local depression and displaced rim have equal volume, including next to a bank.
    for (let j = 0; j < nodes.length; j += 2) {
      const i = nodes[j];
      this.velocity[i] += strength * (nodes[j + 1] - weight / total);
    }
  }

  step(windX, windZ, gust) {
    const { height: h, velocity: v, mass, points: p, pairs, stiffness, accel: a, dt } = this;
    this.previous.set(h);
    a.fill(0);
    const sin = Math.sin(this.clock * 2.8),
      cos = Math.cos(this.clock * 2.8);
    for (let i = 0; i < h.length; i++) this.pressure[i] = this.windSin[i] * cos - this.windCos[i] * sin;
    for (let e = 0; e < stiffness.length; e++) {
      const i = pairs[2 * e],
        j = pairs[2 * e + 1];
      const along = (p[3 * j] - p[3 * i]) * windX + (p[3 * j + 2] - p[3 * i + 2]) * windZ;
      const stress = 0.15 * gust * along * Math.min(mass[i], mass[j]) * (this.pressure[i] + this.pressure[j]);
      const flux = stiffness[e] * (h[j] - h[i]) - stress;
      a[i] += flux;
      a[j] -= flux;
    }
    const damping = Math.exp(-1.15 * dt);
    for (let i = 0; i < h.length; i++)
      if (mass[i]) {
        v[i] = (v[i] + (dt * a[i]) / mass[i]) * damping;
        h[i] += dt * v[i];
      }
    this.clock += dt;
  }
}

export function waterSurface(xs, zs, pointAt, ownerAt, water, wind) {
  const vertices = [],
    indices = [],
    owners = [],
    node = new Map();
  function vertex(x, z) {
    const key = z * (xs + 1) + x;
    if (!node.has(key)) {
      node.set(key, vertices.length / 3);
      vertices.push(...pointAt(x, z));
    }
    return node.get(key);
  }
  for (let z = 0; z < zs; z++)
    for (let x = 0; x < xs; x++) {
      const owner = ownerAt(x, z);
      if (owner < 0) continue;
      const a = vertex(x, z),
        b = vertex(x, z + 1),
        c = vertex(x + 1, z + 1),
        d = vertex(x + 1, z);
      indices.push(a, b, d, b, c, d);
      owners.push(owner, owner);
    }
  const base = Float32Array.from(vertices),
    field = new WaveField(base, indices, owners);
  const geo = new THREE.BufferGeometry(),
    positions = new THREE.BufferAttribute(base.slice(), 3);
  positions.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', positions);
  const motion = new THREE.BufferAttribute(new Float32Array((2 * base.length) / 3), 2);
  motion.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('wave', motion);
  const slope = new THREE.BufferAttribute(new Float32Array(motion.array.length), 2);
  slope.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('slope', slope);
  function updateSlopes() {
    const normals = slope.array,
      pts = positions.array,
      faces = field.visible;
    normals.fill(0);
    for (let t = 0; t < faces.length; t += 3) {
      const a = faces[t],
        b = faces[t + 1],
        c = faces[t + 2],
        i = 3 * a,
        j = 3 * b,
        k = 3 * c;
      const nx =
        (pts[j + 1] - pts[i + 1]) * (pts[k + 2] - pts[i + 2]) -
        (pts[j + 2] - pts[i + 2]) * (pts[k + 1] - pts[i + 1]);
      const nz = (pts[j] - pts[i]) * (pts[k + 1] - pts[i + 1]) - (pts[j + 1] - pts[i + 1]) * (pts[k] - pts[i]);
      normals[2 * a] += nx;
      normals[2 * b] += nx;
      normals[2 * c] += nx;
      normals[2 * a + 1] += nz;
      normals[2 * b + 1] += nz;
      normals[2 * c + 1] += nz;
    }
    for (let i = 0; i < field.mass.length; i++)
      if (field.mass[i]) {
        const inv = 1 / (6 * field.mass[i]);
        normals[i * 2] *= inv;
        normals[i * 2 + 1] *= inv;
      }
    slope.needsUpdate = true;
  }
  const uniforms = { ...wind.uniforms, blend: { value: 1 }, rippleScale: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: true,
    vertexShader: `
      attribute vec2 wave,slope; varying vec2 vSlope;uniform float blend; varying vec3 vWorld;varying float vDepth;
      void main(){
        vec3 pos=position;
        pos.y+=wave.x*(1.-blend); vDepth=wave.y;vSlope=slope;
        vWorld=(modelMatrix*vec4(pos,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
      }`,
    fragmentShader: `
      varying vec3 vWorld;varying float vDepth;varying vec2 vSlope;
      uniform vec2 windDir;uniform float windTime,windGust,rippleScale;
      void main(){
        vec2 d=windDir,across=vec2(-d.y,d.x),p=vWorld.xz;
        float s=dot(p,d),l=dot(p,across);
        float a=s*13.+1.14*sin(l*3.2+s*.72+windTime*.6)+.75*sin(l*4.9+s*1.3)-windTime*4.1;
        float b=s*17.+l*4.-windTime*5.6;
        vec3 n=normalize(vec3(vSlope.x,1.,vSlope.y));
        n.xz+=(d*.049*cos(a)+(d*.022+across*.014)*cos(b))*rippleScale*windGust;
        n=normalize(n);
        vec3 eye=normalize(cameraPosition-vWorld);
        vec3 light=normalize(vec3(-.43,.82,.43));
        float fres=pow(1.-max(dot(n,eye),0.),3.);
        float ridge=smoothstep(.86,.997,sin(a+.3*sin(b)))*smoothstep(.05,.72,sin(l*5.1+s)*sin(s*1.5-l*2.));
        vec3 color=mix(vec3(.15,.36,.29),vec3(.042,.226,.218),vDepth);
        color+=fres*vec3(.32,.32,.23);
        color+=(.09*ridge*rippleScale*windGust+.32*pow(max(dot(n,normalize(eye+light)),0.),64.))*vec3(.85,.91,.76);
        gl_FragColor=vec4(color,.78+.13*vDepth);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = '活动水面';
  const cells = Uint32Array.from(new Set(owners));
  let mask,
    levels,
    rainDebt = 0,
    seed = 9731;
  function configure(amounts) {
    // Only wet/dry transitions change connectivity. Depth still follows every snapshot.
    let changed = !mask,
      updated = !levels;
    if (!mask) {
      mask = new Uint8Array(amounts.length);
      levels = new Float32Array(amounts.length);
    }
    for (const i of cells) {
      const wet = Number(amounts[i] >= 15),
        level = Math.fround(amounts[i]);
      if (wet !== mask[i]) {
        mask[i] = wet;
        changed = true;
      }
      if (level !== levels[i]) {
        levels[i] = level;
        updated = true;
      }
    }
    if (!updated && !changed) return;
    if (changed) {
      const ids = field.configure(amounts);
      geo.setIndex(ids);
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      if (geo.boundingBox) {
        geo.boundingBox.min.y -= 0.5;
        geo.boundingBox.max.y += 0.5;
      }
      if (geo.boundingSphere) geo.boundingSphere.radius += 0.5;
    }
    // Interpolate the latest cell levels to vertices without rebuilding triangles.
    field.depth.fill(0);
    for (let t = 0; t < owners.length; t++)
      if (mask[owners[t]]) {
        const depth = amounts[owners[t]] * 0.01;
        for (let j = 0; j < 3; j++) {
          const i = indices[t * 3 + j];
          field.depth[i] = Math.max(field.depth[i], depth);
        }
      }
    for (let e = 0; e < field.weights.length; e++) {
      const a = field.pairs[2 * e],
        b = field.pairs[2 * e + 1];
      field.stiffness[e] = 9.81 * (0.08 + 0.34 * Math.min(field.depth[a], field.depth[b])) * field.weights[e];
    }
    for (let i = 0; i < field.depth.length; i++) {
      motion.setY(i, field.depth[i]);
      positions.setY(i, base[3 * i + 1] - 0.13 * (1 - field.depth[i]) + field.height[i]);
    }
    positions.needsUpdate = true;
    motion.needsUpdate = true;
    updateSlopes();
  }
  configure(water);
  function frame(delta, reduced, rain = 0) {
    uniforms.rippleScale.value = reduced ? 0 : 1;
    if (reduced || !delta || !field.visible.length) return;
    field.remainder += Math.min(0.08, delta);
    const dir = wind.uniforms.windDir.value;
    let advanced = false;
    while (field.remainder >= field.dt) {
      const wet = field.visible;
      rainDebt += ((Math.min(7, Math.max(0, rain)) * 0.008 * wet.length) / 3) * field.dt;
      while (rainDebt >= 1 && wet.length) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const i = wet[seed % wet.length];
        field.disturb(base[3 * i], base[3 * i + 2], -0.11, 0.83);
        rainDebt--;
      }
      field.step(dir.x, dir.y, wind.uniforms.windGust.value);
      field.remainder -= field.dt;
      advanced = true;
    }
    if (advanced) {
      for (let i = 0; i < field.height.length; i++) {
        positions.setY(i, base[3 * i + 1] - 0.13 * (1 - field.depth[i]) + field.height[i]);
        motion.setX(i, field.previous[i] - field.height[i]);
      }
      positions.needsUpdate = motion.needsUpdate = true;
      updateSlopes();
    }
    uniforms.blend.value = field.remainder / field.dt;
  }
  function levelAt(gx, gz) {
    const x = Math.floor(gx),
      z = Math.floor(gz);
    if (x < 0 || z < 0 || x >= xs || z >= zs || !mask[ownerAt(x, z)]) return null;
    const u = gx - x,
      v = gz - z,
      j = z * (xs + 1) + x;
    function level(key) {
      const i = node.get(key);
      return positions.getY(i) + motion.getX(i) * (1 - uniforms.blend.value);
    }
    const b = level(j + xs + 1),
      d = level(j + 1);
    return u + v <= 1
      ? level(j) * (1 - u - v) + b * v + d * u
      : level(j + xs + 2) * (u + v - 1) + b * (1 - u) + d * (1 - v);
  }
  return {
    mesh,
    field,
    configure,
    frame,
    levelAt,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
