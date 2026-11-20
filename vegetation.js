import * as THREE from 'three';
import { bendGrass } from './environment.js';
import { receiveDaylight } from './lighting.js';

const clamp = THREE.MathUtils.clamp;
const pose = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0),
  groundNormal = new THREE.Vector3();
function noise(n) {
  let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Two samples per metre store the signed direction in which the stems are pressed.
export function grassTracks(w, h) {
  const cols = w * 2,
    rows = h * 2;
  const pixels = new Uint8Array(cols * rows * 2).fill(128);
  const texture = new THREE.DataTexture(pixels, cols, rows, THREE.RGFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const bent = new Set();
  let elapsed = 0;
  function brush(x, z, dx, dz, size) {
    const travel = Math.hypot(dx, dz);
    if (!travel) return;
    const radius = 0.42 + 0.42 * size;
    const cx = (x + w / 2) * 2 - 0.5,
      cz = (z + h / 2) * 2 - 0.5;
    for (let j = Math.max(0, Math.ceil(cz - 2 * radius)); j <= Math.min(rows - 1, cz + 2 * radius); j++)
      for (let i = Math.max(0, Math.ceil(cx - 2 * radius)); i <= Math.min(cols - 1, cx + 2 * radius); i++) {
        const rx = (i - cx) / (2 * radius),
          rz = (j - cz) / (2 * radius);
        const pressure = 1 - rx * rx - rz * rz;
        if (pressure <= 0) continue;
        const id = j * cols + i;
        const vx = (dx / travel) * 0.8 + rx,
          vz = (dz / travel) * 0.8 + rz;
        const length = Math.max(0.25, Math.hypot(vx, vz));
        pixels[2 * id] = 128 + Math.round((125 * pressure * vx) / length);
        pixels[2 * id + 1] = 128 + Math.round((125 * pressure * vz) / length);
        bent.add(id);
      }
  }
  function advance(dt) {
    elapsed += dt;
    if (elapsed < 0.05) return;
    const recovery = Math.exp(-elapsed * 1.25);
    elapsed = 0;
    if (!bent.size) return;
    for (const id of bent) {
      const j = 2 * id;
      const x = Math.trunc((pixels[j] - 128) * recovery),
        z = Math.trunc((pixels[j + 1] - 128) * recovery);
      pixels[j] = 128 + x;
      pixels[j + 1] = 128 + z;
      if (!x && !z) bent.delete(id);
    }
    texture.needsUpdate = true;
  }
  return { texture, brush, advance };
}

function grassTuft(detail) {
  const positions = [],
    colors = [],
    roots = [],
    indices = [];
  const count = detail ? 25 : 7;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996 + noise(i + 27) * 0.5,
      dx = Math.cos(angle),
      dz = Math.sin(angle);
    const straw = i % 9 === 6;
    const height = 0.19 + 0.26 * noise(i + 45) + (straw ? 0.14 : 0);
    const reach = height * (0.34 + 0.79 * noise(i + 91)),
      width = (detail ? 0.009 : 0.019) + noise(i + 23) * 0.008;
    const rootX = (noise(i + 115) - 0.5) * 0.4,
      rootZ = (noise(i + 157) - 0.5) * 0.4;
    const tone = noise(i + 77);
    const root = new THREE.Color(straw ? 0x8b8357 : 0x647a43);
    const tip = new THREE.Color(straw ? 0xd8c898 : 0xc5c77a).lerp(new THREE.Color(0x799959), tone * 0.8);
    const start = positions.length / 3;
    const rank = (((i * 11) % count) + 0.5) / count;
    function point(t, side) {
      const r = 0.035 + t * t * reach,
        half = width * (1 - 0.8 * t) * side;
      positions.push(rootX + dx * r - dz * half, height * t * (1 - 0.14 * t), rootZ + dz * r + dx * half);
      roots.push(rootX + dx * 0.035, rootZ + dz * 0.035, rank);
      const pigment = root.clone().lerp(tip, t * 0.87 + 0.1);
      colors.push(pigment.r, pigment.g, pigment.b);
    }
    point(0, -1);
    point(0, 1);
    if (detail) {
      point(0.52, -1);
      point(0.52, 1);
      point(1, 0);
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2, start + 2, start + 3, start + 4);
    } else {
      point(1, 0);
      indices.push(start, start + 1, start + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('grassRoot', new THREE.Float32BufferAttribute(roots, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const normal = g.attributes.normal;
  for (let i = 0; i < normal.count; i++) normal.setXYZ(i, normal.getX(i) * 0.45, 1, normal.getZ(i) * 0.45);
  return g;
}

// Crossed, bowed fans use a photographed tuft where individual blade widths fall below a pixel.
function meadowFans() {
  const positions = [],
    uvs = [],
    indices = [],
    roots = [],
    normals = [];
  for (let j = 0; j < 2; j++) {
    const a = (j * Math.PI) / 2,
      dx = 0.49 * Math.cos(a),
      dz = 0.49 * Math.sin(a);
    const start = positions.length / 3;
    for (const t of [0, 0.55, 1])
      for (const side of [-1, 1]) {
        const bow = t * t * 0.28;
        positions.push(side * dx + bow * dz, 0.36 * t, side * dz - bow * dx);
        roots.push(0, 0, -1); // Both halves of a photographed tuft emerge together.
        normals.push(0, 1, 0);
        uvs.push((side + 1) / 2, t);
      }
    for (const k of [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]) indices.push(start + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('grassRoot', new THREE.Float32BufferAttribute(roots, 3));
  g.setIndex(indices);
  return g;
}

export function meadow(group, state, heightAt, groundMap, wind, cloud, tuftMap) {
  const { width: w, height: h, terrain } = state;
  const seed = Number(BigInt(state.seed) & 0xffffffffn);
  const tracks = grassTracks(w, h);
  const field = {
    grassMap: { value: groundMap },
    pressMap: { value: tracks.texture },
    fieldSize: { value: new THREE.Vector2(w, h) },
    detailEye: { value: new THREE.Vector3() },
  };
  function mesh(detail, capacity) {
    const map = detail ? null : tuftMap;
    const alphaTest = map ? 0.21 : 0;
    const material = bendGrass(
      new THREE.MeshLambertMaterial({ map, alphaTest, vertexColors: !map, side: THREE.DoubleSide }),
      wind,
      field,
      detail,
    );
    const m = new THREE.InstancedMesh(
      map ? meadowFans() : grassTuft(detail),
      receiveDaylight(material, cloud),
      capacity,
    );
    m.name = detail ? '近岸细草' : '漫滩草甸';
    m.frustumCulled = false;
    m.castShadow = m.receiveShadow = true;
    m.customDepthMaterial = bendGrass(
      new THREE.MeshDepthMaterial({
        map,
        alphaTest,
        depthPacking: THREE.RGBADepthPacking,
        side: THREE.DoubleSide,
      }),
      wind,
      field,
      detail,
    );
    group.add(m);
    return m;
  }
  function plant(batch, index, x, z, key, size) {
    pose.position.set(x, heightAt(x, z, groundNormal) - 0.012, z);
    pose.quaternion.setFromUnitVectors(up, groundNormal);
    pose.rotateY(noise(key + 37) * 2 * Math.PI);
    pose.scale.setScalar(size);
    pose.updateMatrix();
    batch.setMatrixAt(index, pose.matrix);
  }
  function share(template, capacity) {
    const batch = new THREE.InstancedMesh(template.geometry, template.material, capacity);
    batch.customDepthMaterial = template.customDepthMaterial;
    batch.castShadow = batch.receiveShadow = true;
    batch.frustumCulled = false;
    group.add(batch);
    return batch;
  }
  const block = 32,
    capacity = block * block;
  const far = mesh(false, capacity),
    blocks = [];
  for (let z = 0; z < h; z += block)
    for (let x = 0; x < w; x += block) {
      const batch = blocks.length ? share(far, capacity) : far;
      let count = 0;
      // An odd stride visits every cell once and distributes each shorter draw across the block.
      for (let n = 0; n < capacity; n++) {
        const offset = (n * 443) % capacity;
        const i = x + (offset % block),
          j = z + Math.floor(offset / block);
        if (i >= w || j >= h || terrain[j * w + i] === 1) continue;
        const key = ((j * w + i) ^ seed) * 67;
        const px = i + 0.18 + 0.64 * noise(key + 1),
          pz = j + 0.18 + 0.64 * noise(key + 2);
        plant(batch, count++, px - w / 2, pz - h / 2, key, 0.82 + noise(key + 3) * 0.58);
      }
      batch.count = count;
      const center = new THREE.Vector3(x + block / 2 - w / 2, 1, z + block / 2 - h / 2);
      batch.boundingSphere = new THREE.Sphere(center, block * Math.SQRT1_2 + 2);
      batch.frustumCulled = true;
      blocks.push({ batch, count });
    }
  // Recycle four-metre plots around the eye. Keep a margin for wind and off-screen shadow casters.
  const tile = 4,
    span = 7,
    tufts = 6;
  const plots = new Map();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 4.5);
  let near;
  function frame(camera, frustum) {
    const eye = camera.position;
    const cx = Math.floor((eye.x + w / 2) / tile),
      cz = Math.floor((eye.z + h / 2) / tile);
    field.detailEye.value.copy(eye);
    for (const { batch, count } of blocks) {
      const bounds = batch.boundingSphere;
      const range = Math.max(0, bounds.center.distanceTo(eye) - bounds.radius);
      batch.count = Math.ceil(count * (1 - 0.78 * THREE.MathUtils.smoothstep(range, 20, 85)));
    }
    for (const plot of plots.values()) plot.visible = false;
    if (eye.y > 14) return;
    for (let z = Math.max(0, cz - 3); z <= cz + 3 && z * tile < h; z++)
      for (let x = Math.max(0, cx - 3); x <= cx + 3 && x * tile < w; x++) {
        sphere.center.set((x + 0.5) * tile - w / 2, 0.9, (z + 0.5) * tile - h / 2);
        if (sphere.center.distanceToSquared(eye) > 15 ** 2 || !frustum.intersectsSphere(sphere)) continue;
        const slot = (z % span) * span + (x % span);
        let plot = plots.get(slot);
        if (!plot) {
          if (!near) plot = near = mesh(true, tile * tile * tufts);
          else plot = share(near, tile * tile * tufts);
          plots.set(slot, plot);
        }
        plot.visible = true;
        if (plot.userData.x === x && plot.userData.z === z) continue;
        plot.userData.x = x;
        plot.userData.z = z;
        let n = 0;
        for (let j = z * tile; j < Math.min(h, (z + 1) * tile); j++)
          for (let i = x * tile; i < Math.min(w, (x + 1) * tile); i++) {
            const id = j * w + i;
            if (terrain[id] === 1) continue;
            for (let k = 0; k < tufts; k++) {
              const key = ((id * tufts + k) ^ seed) * 61;
              const px = i + ((k % 3) + noise(key + 1)) / 3 - w / 2;
              const pz = j + (Math.floor(k / 3) + noise(key + 2)) / 2 - h / 2;
              plant(plot, n++, px, pz, key, 0.72 + 0.75 * noise(key + 3));
            }
          }
        plot.count = n;
        plot.instanceMatrix.needsUpdate = true;
      }
  }
  function dispose() {
    for (const m of [far, near])
      if (m) {
        m.geometry.dispose();
        m.material.dispose();
        m.customDepthMaterial.dispose();
      }
    tracks.texture.dispose();
  }
  return { frame, tracks, dispose };
}

export function growSal(site, state, steps) {
  const wetSeason = state.season === 'wet_peak' || state.season === 'wet_early';
  const moisture = clamp(state.rainfall / 4 + site.bank * 0.29, 0, 1);
  const heat = clamp(((state.temperature ?? 27) - 27) / 12, 0, 1);
  const fertility = clamp(state.nutrient[site.cell] / 70, 0, 1);
  const target = clamp(
    0.16 + 0.46 * moisture + 0.14 * fertility + (wetSeason ? 0.27 : 0.04) - 0.14 * heat,
    0.09,
    1,
  );
  site.leaf = steps === null ? target : THREE.MathUtils.lerp(site.leaf, target, -Math.expm1(-steps / 14));
  const age = steps === null ? state.tick : steps;
  site.size += (1 - site.size) * -Math.expm1(-age * (0.0003 + 0.0022 * moisture * fertility));
}

function seasonalLeaves(material) {
  material.customProgramCacheKey = () => 'sal-leaf-exchange';
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 _bud; attribute float foliage;\nfloat budOrder(){return fract(sin(dot(_bud,vec3(13.7,37.1,19.3)))*4375.4);}',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float order=budOrder();
        float unfold=smoothstep(order*.91,order*.91+.09,foliage);
        transformed=_bud+(position-_bud)*unfold;`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_COLOR
          vec3 dry=vec3(.48,.28,.095)*(.55+.45*color.g);
          vColor.rgb=mix(dry,vColor.rgb,smoothstep(.02,.56,foliage-budOrder()*.40));
        #endif`,
      );
  };
  return material;
}

export function salGrove(group, tree, sites, cloud) {
  const parts = [];
  let lastTick;
  const leaves = new THREE.InstancedBufferAttribute(new Float32Array(sites.length), 1);
  if (tree && sites.length) {
    const inverse = tree.matrixWorld.clone().invert();
    tree.traverse((part) => {
      if (!part.isMesh) return;
      const isLeaf = part.geometry.hasAttribute('_bud');
      const g = isLeaf ? part.geometry.clone() : part.geometry;
      const mat = isLeaf ? seasonalLeaves(part.material.clone()) : part.material;
      if (isLeaf) g.setAttribute('foliage', leaves);
      const mesh = new THREE.InstancedMesh(g, receiveDaylight(mat, cloud), sites.length);
      if (isLeaf)
        mesh.customDepthMaterial = seasonalLeaves(
          new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }),
        );
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      parts.push({ mesh, local: inverse.clone().multiply(part.matrixWorld), isLeaf });
      group.add(mesh);
    });
  }
  const matrix = new THREE.Matrix4();
  function update(s) {
    sites.forEach((p, i) => {
      growSal(p, s, lastTick == null ? null : Math.max(0, s.tick - lastTick));
      leaves.setX(i, p.leaf);
      pose.position.set(p.x, p.y, p.z);
      pose.rotation.set(0, p.angle, 0);
      pose.scale.setScalar(p.scale * p.size);
      pose.updateMatrix();
      for (const { mesh, local } of parts) mesh.setMatrixAt(i, matrix.multiplyMatrices(pose.matrix, local));
    });
    leaves.needsUpdate = true;
    for (const { mesh } of parts) mesh.instanceMatrix.needsUpdate = true;
    lastTick = s.tick;
  }
  function dispose() {
    for (const { mesh, isLeaf } of parts)
      if (isLeaf) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.customDepthMaterial.dispose();
      }
  }
  return { update, dispose };
}
