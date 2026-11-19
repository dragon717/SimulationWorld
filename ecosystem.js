import * as THREE from 'three';
import { groundRelief, receiveDaylight } from './lighting.js';
import { breeze, bendGrass } from './environment.js';
import { waterSurface } from './river.js';
import { activity, channels, animateMaterial, samplePlaybackPose } from './motion.js';

const speciesViews = { deer: 'chital', tiger: 'tiger', crocodile: 'mugger' };
const names = { 'Axis axis': 'chital', 'Panthera tigris tigris': 'tiger', 'Crocodylus palustris': 'mugger' };
const pose = new THREE.Object3D();
const up = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();

function tuftGeometry() {
  const vertices = [];
  for (let blade = 0; blade < 9; blade++) {
    const a = blade * 2.4,
      dx = Math.cos(a),
      dz = Math.sin(a),
      h = 0.18 + (blade % 4) * 0.075;
    const strip = (t, side) => [
      dx * h * 0.6 * t * t - dz * side * 0.035 * (1 - t),
      h * t,
      dz * h * 0.6 * t * t + dx * side * 0.035 * (1 - t),
    ];
    const a0 = strip(0, -1),
      b0 = strip(0, 1),
      a1 = strip(0.55, -1),
      b1 = strip(0.55, 1),
      tip = strip(1, 0);
    vertices.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1, ...a1, ...b1, ...tip);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const colors = [];
  for (let i = 0; i < vertices.length; i += 3) {
    const height = THREE.MathUtils.clamp(vertices[i + 1] / 0.38, 0, 1);
    colors.push(0.49 + 0.63 * height, 0.56 + 0.53 * height, 0.4 + 0.46 * height);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function createLandscape(scene, state, tree, soil) {
  const { width: w, height: h, terrain } = state;
  const n = w * h;
  const wind = breeze(state.seed);
  const sub = 2;
  const geometry = new THREE.PlaneGeometry(w, h, w, h).rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  // Distance from the river determines relief and bank vegetation; every channel comes from the grid.
  const distance = new Uint16Array(n).fill(65535);
  const queue = [];
  for (let i = 0; i < n; i++)
    if (terrain[i] === 1) {
      distance[i] = 0;
      queue.push(i);
    }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q],
      x = i % w;
    const neighbors = [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, i - w, i + w];
    for (const j of neighbors)
      if (j >= 0 && j < n && distance[j] > distance[i] + 1) {
        distance[j] = distance[i] + 1;
        queue.push(j);
      }
  }
  const elevation = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % w,
      y = Math.floor(i / w);
    elevation[i] =
      terrain[i] === 1
        ? -0.16
        : 0.05 + Math.min(distance[i] / 5, 1) * (0.75 + 0.33 * Math.sin(x * 0.1) + 0.24 * Math.cos(y * 0.16));
  }
  function index(x, y) {
    return Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x));
  }
  for (let y = 0; y <= h; y++)
    for (let x = 0; x <= w; x++) {
      const i = y * (w + 1) + x;
      positions.setY(
        i,
        (elevation[index(x - 1, y - 1)] +
          elevation[index(x, y - 1)] +
          elevation[index(x - 1, y)] +
          elevation[index(x, y)]) /
          4,
      );
      geometry.attributes.uv.setY(i, y / h);
    }
  geometry.computeVertexNormals();
  function surface(x, y) {
    const i = y * (w + 1) + x;
    return (positions.getY(i + 1) + positions.getY(i + w + 1)) * 0.5;
  }
  function heightAt(wx, wz, outNormal) {
    const gx = THREE.MathUtils.clamp(wx + w / 2, 0, w - 1e-8),
      gz = THREE.MathUtils.clamp(wz + h / 2, 0, h - 1e-8);
    const x = Math.floor(gx),
      z = Math.floor(gz),
      u = gx - x,
      v = gz - z,
      j = z * (w + 1) + x;
    const lo = u + v <= 1;
    const b = positions.getY(j + w + 1),
      d = positions.getY(j + 1),
      tip = positions.getY(lo ? j : j + w + 2);
    if (outNormal) outNormal.set(lo ? tip - d : b - tip, 1, lo ? tip - b : d - tip).normalize();
    return lo ? tip * (1 - u - v) + d * u + b * v : tip * (u + v - 1) + b * (1 - u) + d * (1 - v);
  }
  const river = waterSurface(
    w * sub,
    h * sub,
    (x, z) => [x / sub - w / 2, 0.038, z / sub - h / 2],
    (x, z) => {
      const i = Math.floor(z / sub) * w + Math.floor(x / sub);
      return terrain[i] === 1 ? i : -1;
    },
    state.water,
    wind,
    heightAt,
  );
  const pixels = new Uint8Array(n * 4);
  const map = new THREE.DataTexture(pixels, w, h);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  const ground = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map }));
  if (soil) groundRelief(ground.material, soil);
  receiveDaylight(ground.material, scene.userData.cloudShadow);
  ground.name = '模拟地表';
  ground.receiveShadow = true;
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x);
  for (let y = 0; y < h; y++) edge.push(y * (w + 1) + w);
  for (let x = w; x > 0; x--) edge.push(h * (w + 1) + x);
  for (let y = h; y > 0; y--) edge.push(y * (w + 1));
  const skirt = [];
  edge.forEach((j, k) => {
    const l = edge[(k + 1) % edge.length];
    const a = [positions.getX(j), positions.getY(j), positions.getZ(j)];
    const b = [positions.getX(l), positions.getY(l), positions.getZ(l)];
    const c = [b[0], -1.41, b[2]],
      d = [a[0], -1.41, a[2]];
    skirt.push(...a, ...b, ...c, ...a, ...c, ...d);
  });
  const sides = new THREE.BufferGeometry();
  sides.setAttribute('position', new THREE.Float32BufferAttribute(skirt, 3));
  sides.computeVertexNormals();
  const cut = new THREE.Mesh(sides, new THREE.MeshStandardMaterial({ color: 0x9b896d, side: THREE.DoubleSide }));
  const group = new THREE.Group();
  group.add(ground, cut, river.mesh);
  scene.add(group);

  const clumps = [];
  const groves = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!distance[i]) continue;
      const noise = Math.abs(Math.sin(x * 21.7 + y * 53.3) * 43758.5453) % 1;
      if (noise < 0.27)
        clumps.push({ i, x: x + 0.5 - w / 2, z: y + 0.5 - h / 2, y: surface(x, y), angle: noise * 33 });
      if (distance[i] > 2 && distance[i] < 16 && noise > 0.995 && Math.sin(x * 0.11 + y * 0.09) > 0.2) {
        groves.push({
          x: x + 0.5 - w / 2,
          y: surface(x, y),
          z: y + 0.5 - h / 2,
          angle: noise * 126,
          scale: 0.78 + (noise % 0.41),
        });
      }
    }
  const grass = new THREE.InstancedMesh(
    tuftGeometry(),
    bendGrass(
      new THREE.MeshLambertMaterial({ color: 0x89995b, vertexColors: true, side: THREE.DoubleSide }),
      wind,
      true,
    ),
    clumps.length,
  );
  grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  receiveDaylight(grass.material, scene.userData.cloudShadow);
  grass.frustumCulled = false;
  grass.castShadow = grass.receiveShadow = true;
  grass.customDepthMaterial = bendGrass(
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }),
    wind,
    true,
  );
  group.add(grass);
  if (tree && groves.length) {
    const inverse = tree.matrixWorld.clone().invert();
    tree.traverse((part) => {
      if (!part.isMesh) return;
      const trees = new THREE.InstancedMesh(
        part.geometry,
        receiveDaylight(part.material, scene.userData.cloudShadow),
        groves.length,
      );
      const local = new THREE.Matrix4().multiplyMatrices(inverse, part.matrixWorld);
      groves.forEach((p, i) => {
        pose.position.set(p.x, p.y, p.z);
        pose.rotation.set(0, p.angle, 0);
        pose.scale.setScalar(p.scale);
        pose.updateMatrix();
        trees.setMatrixAt(i, matrix.multiplyMatrices(pose.matrix, local));
      });
      trees.castShadow = trees.receiveShadow = true;
      group.add(trees);
    });
  }
  clumps.forEach((p, i) => {
    pose.position.set(p.x, p.y, p.z);
    pose.rotation.set(0, p.angle, 0);
    pose.scale.setScalar(1);
    pose.updateMatrix();
    grass.setMatrixAt(i, pose.matrix);
  });
  const baseMatrices = grass.instanceMatrix.array.slice();
  function update(s) {
    river.configure(s.water);
    const wet = Math.min(1, s.rainfall / 4);
    for (let i = 0; i < n; i++) {
      const j = i * 4,
        g = Math.min(1, s.grass[i] / 100),
        soil = Math.min(1, s.nutrient[i] / 100);
      if (terrain[i] === 1) {
        const water = Math.min(1, s.water[i] / 100);
        if (s.water[i] < 15) {
          pixels[j] = 140 + water * 22;
          pixels[j + 1] = 127 + water * 15;
          pixels[j + 2] = 91 + water * 14;
        } else {
          pixels[j] = 154 - 54 * water;
          pixels[j + 1] = 146 - 41 * water;
          pixels[j + 2] = 113 - 23 * water;
        }
      } else {
        const bank = Math.max(0, 1 - distance[i] / 3) * 0.45;
        pixels[j] = 179 - 58 * g - 14 * wet + 23 * bank - 6 * soil;
        pixels[j + 1] = 168 - 25 * g + 3 * wet + 13 * bank;
        pixels[j + 2] = 115 - 31 * g + 12 * wet + 22 * bank;
      }
      pixels[j + 3] = 255;
    }
    map.needsUpdate = true;
    const out = grass.instanceMatrix.array;
    clumps.forEach((p, i) => {
      const scale = Math.min(1.65, Math.max(0.015, s.grass[p.i] / 36)),
        j = i * 16;
      out[j] = baseMatrices[j] * scale;
      out[j + 2] = baseMatrices[j + 2] * scale;
      out[j + 5] = scale;
      out[j + 8] = baseMatrices[j + 8] * scale;
      out[j + 10] = baseMatrices[j + 10] * scale;
    });
    grass.instanceMatrix.needsUpdate = true;
  }
  geometry.computeBoundingBox();
  const rayStart = new THREE.Vector3(),
    hit = new THREE.Vector3();
  const corners = Array.from({ length: 4 }, () => new THREE.Vector3());
  // Traverse only cells touched by the ray, testing exactly the two displayed triangles.
  function pick(ray) {
    if (geometry.boundingBox.containsPoint(ray.origin)) rayStart.copy(ray.origin);
    else if (!ray.intersectBox(geometry.boundingBox, rayStart)) return null;
    const dx = ray.direction.x,
      dz = ray.direction.z;
    let x = THREE.MathUtils.clamp(Math.floor(rayStart.x + w / 2), 0, w - 1);
    let y = THREE.MathUtils.clamp(Math.floor(rayStart.z + h / 2), 0, h - 1);
    let tx = dx ? (x + Number(dx > 0) - w / 2 - rayStart.x) / dx : Infinity;
    let tz = dz ? (y + Number(dz > 0) - h / 2 - rayStart.z) / dz : Infinity;
    while (x >= 0 && x < w && y >= 0 && y < h) {
      const j = y * (w + 1) + x;
      const [a, b, c, d] = corners;
      a.fromBufferAttribute(positions, j);
      b.fromBufferAttribute(positions, j + w + 1);
      c.fromBufferAttribute(positions, j + w + 2);
      d.fromBufferAttribute(positions, j + 1);
      if (ray.intersectTriangle(a, b, d, false, hit) || ray.intersectTriangle(b, c, d, false, hit)) return hit;
      if (!dx && !dz) break;
      if (tx < tz) {
        x += Math.sign(dx);
        tx += Math.abs(1 / dx);
      } else {
        y += Math.sign(dz);
        tz += Math.abs(1 / dz);
      }
    }
    return null;
  }
  function dispose() {
    scene.remove(group);
    group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    for (const m of [ground, cut, grass]) {
      m.material.dispose();
      m.geometry.dispose();
    }
    grass.customDepthMaterial.dispose();
    map.dispose();
    river.dispose();
  }
  return { ground, surface, heightAt, update, dispose, pick, river, wind };
}

// Models share geometry and materials. Each snapshot animal keeps its own position, heading and age.
function animalBatch(scene, root, kind, detailed, cloud) {
  const parts = [];
  root.traverse((part) => {
    if (part.isMesh) parts.push(part);
  });
  let capacity = 0,
    meshes = [],
    weights,
    phases;
  return function draw(visible, warm = false) {
    if (visible.length > capacity || (warm && !capacity)) {
      for (const m of meshes) {
        scene.remove(m);
        m.dispose();
      }
      capacity = Math.max(16, visible.length * 2);
      weights = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(
        THREE.DynamicDrawUsage,
      );
      phases = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
      meshes = parts.map((part) => {
        const g = part.geometry;
        let mat = part.material;
        if (g.hasAttribute('_part')) {
          g.setAttribute('actions', weights);
          g.setAttribute('stridePhase', phases);
          if (!part.userData.poseMaterial) {
            const skin = detailed
              ? mat.clone()
              : new THREE.MeshLambertMaterial({
                  map: mat.map,
                  vertexColors: mat.vertexColors,
                  side: mat.side,
                  color: mat.color,
                });
            if (detailed) skin.roughness = Math.min(skin.roughness, kind === 'mugger' ? 0.48 : 0.82);
            part.userData.poseMaterial = animateMaterial(skin, kind);
            part.userData.poseDepth = animateMaterial(
              new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
              kind,
            );
          }
          mat = part.userData.poseMaterial;
        }
        const m = new THREE.InstancedMesh(g, receiveDaylight(mat, cloud), capacity);
        m.castShadow = m.receiveShadow = true;
        if (part.userData.poseDepth) m.customDepthMaterial = part.userData.poseDepth;
        m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(m);
        return m;
      });
    }
    for (let i = 0; i < visible.length; i++) {
      const a = visible[i];
      pose.position.copy(a.position);
      pose.quaternion.setFromUnitVectors(up, a.normal);
      pose.rotateY(a.facing);
      pose.scale.setScalar(a.size);
      pose.updateMatrix();
      for (const mesh of meshes) mesh.setMatrixAt(i, pose.matrix);
      weights.setXYZW(i, ...a.weights);
      phases.setX(i, a.phase);
    }
    for (const m of meshes) {
      m.count = visible.length;
      if (m.count) m.instanceMatrix.needsUpdate = true;
    }
    if (visible.length) {
      weights.needsUpdate = phases.needsUpdate = true;
    }
  };
}

export function createEcosystem(scene, library, soil) {
  let tree;
  const batches = {},
    fine = {},
    close = {},
    far = {};
  function register(lib, target, container = scene) {
    lib.updateMatrixWorld(true);
    lib.traverse((node) => {
      const key = names[node.userData.scientificName];
      if (key) {
        const kind = /doe/i.test(node.name) ? 'doe' : key;
        target[kind] = animalBatch(container, node, kind, target !== batches, scene.userData.cloudShadow);
        close[kind] ??= [];
        far[kind] ??= [];
      }
      if (!tree && (node.userData.template || node.userData.name)?.startsWith('Sal · broadleaf')) tree = node;
    });
  }
  register(library, batches);
  const shadowGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowInk = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 v;void main(){float r=length(2.*v-1.);gl_FragColor=vec4(.055,.072,.06,.18*(1.-smoothstep(.28,1.,r)));}`,
  });
  let shadows,
    shadowCapacity = 0,
    freezeAt = null;
  const eggMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e4b5 });
  const corpseMaterial = new THREE.MeshStandardMaterial({ color: 0x6b5247 });
  const markerGeometry = new THREE.IcosahedronGeometry(1, 1);
  let markers = [];
  let actors = new Map(),
    groups = {},
    landscape,
    last,
    started = 0,
    duration = 0,
    streaming = false;
  function update(s, interval = 800, continuous = false, receivedAt = performance.now()) {
    freezeAt = null;
    if (s.animals.length > shadowCapacity) {
      if (shadows) {
        scene.remove(shadows);
        shadows.dispose();
      }
      shadowCapacity = s.animals.length * 2;
      shadows = new THREE.InstancedMesh(shadowGeometry, shadowInk, shadowCapacity);
      shadows.frustumCulled = false;
      scene.add(shadows);
    }
    const reset =
      !last ||
      s.tick < last.tick ||
      s.seed !== last.seed ||
      s.width !== last.width ||
      s.height !== last.height ||
      s.tick === 0;
    if (reset) {
      landscape?.dispose();
      landscape = createLandscape(scene, s, tree, soil);
      actors.clear();
    }
    // Slight playout slack at 1× absorbs jitter without predicting another cell.
    duration =
      !reset && last && s.tick === last.tick + 1 ? interval * (continuous && interval === 1000 ? 1.14 : 1) : 0;
    landscape.update(s);
    const next = new Map();
    groups = {};
    const eats = new Set(s.eaters);
    for (const a of s.animals) {
      const view = speciesViews[a.species];
      const key = view === 'chital' && (a.age < a.mature_age || a.id % 2 === 0) ? 'doe' : view;
      const old = actors.get(a.id);
      const size = a.age >= a.mature_age ? 1 : 0.52 + (0.48 * a.age) / a.mature_age;
      const to = new THREE.Vector3(a.x + 0.5 - s.width / 2, landscape.surface(a.x, a.y), a.y + 0.5 - s.height / 2);
      if (view === 'mugger' && s.water[a.y * s.width + a.x] >= 15) to.y -= 0.23 * size;
      const contiguous = old && !reset && s.tick === last.tick + 1;
      const act = activity(s, a, contiguous ? old : null, eats, last);
      const previous = contiguous ? old : null;
      const heading = act.heading ?? previous?.facing ?? a.id * 2.4;
      const phase = previous?.phase ?? a.id * 1.31;
      const weights = previous?.weights.slice() ?? [0, 0, 0, 0];
      if (view === 'tiger' && s.terrain[a.y * s.width + a.x] === 1 && s.water[a.y * s.width + a.x] >= 15)
        to.y -= 0.67 * size;
      const from = previous?.position.clone() ?? to.clone();
      const via = previous?.to ?? to;
      const remaining = Math.hypot(via.x - from.x, via.z - from.z);
      const stride = size * (act.name === 'swim' && view === 'mugger' ? 1.8 : view === 'mugger' ? 0.68 : 1.4);
      const facing = previous?.facing ?? heading;
      const angle = heading - facing;
      const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
      const actor = {
        action: act.name,
        normal: new THREE.Vector3(0, 1, 0),
        wakeAt: old?.wakeAt ?? -Infinity,
        wakeX: old?.wakeX ?? to.x,
        wakeZ: old?.wakeZ ?? to.z,
        cellX: a.x,
        cellY: a.y,
        heading,
        facing,
        startFacing: facing,
        turn,
        startPhase: phase,
        phase,
        remaining,
        via,
        edgeDistance: act.distance ?? 0,
        stride,
        previousStride: previous?.stride ?? stride,
        previousSpeed: previous?.travelSpeed ?? 0,
        travelSpeed: duration ? (remaining + (act.distance ?? 0)) / duration : 0,
        restingCycles: act.name === 'drink' ? (view === 'tiger' ? 1.7 : 0.7) : act.name === 'feed' ? 1 : 0.32,
        entryBrake: previous?.edgeDistance ? Math.min(1, 1 - Math.cos(turn)) : 1,
        weights,
        startWeights: weights.slice(),
        targetWeights: channels.map((name) => Number(name === act.name)),
        id: a.id,
        view,
        size,
        energy: a.energy,
        age: a.age,
        to,
        from,
        position: from.clone(),
      };
      next.set(a.id, actor);
      (groups[key] ??= []).push(actor);
    }
    actors = next;
    markers.forEach((m) => {
      scene.remove(m);
      m.dispose();
    });
    markers = [];
    for (const [items, mat, isEgg] of [
      [s.eggs, eggMaterial, true],
      [s.corpses, corpseMaterial, false],
    ]) {
      if (!items.length) continue;
      const m = new THREE.InstancedMesh(
        markerGeometry,
        receiveDaylight(mat, scene.userData.cloudShadow),
        items.length,
      );
      m.castShadow = m.receiveShadow = true;
      items.forEach((item, i) => {
        const decay = isEgg ? 1 : Math.max(0.22, item.remaining / item.total);
        pose.position.set(
          item.x + 0.5 - s.width / 2,
          landscape.surface(item.x, item.y) + (isEgg ? 0.16 : 0.11),
          item.y + 0.5 - s.height / 2,
        );
        pose.rotation.set(0, item.id * 2.4, isEgg ? 0.3 : 0);
        pose.scale.set(isEgg ? 0.19 : 0.63 * decay, isEgg ? 0.27 : 0.17 * decay, isEgg ? 0.19 : 0.29 * decay);
        pose.updateMatrix();
        m.setMatrixAt(i, pose.matrix);
      });
      scene.add(m);
      markers.push(m);
    }
    started = receivedAt;
    streaming = continuous;

    last = s;
  }
  const frustum = new THREE.Frustum();
  const bounds = new THREE.Sphere(new THREE.Vector3(), 6);
  let previousFrame;
  function frame(now, reduceMotion, camera) {
    const dt = previousFrame == null ? 0 : Math.max(0, (now - previousFrame) * 0.001);
    previousFrame = now;
    landscape.wind.advance(dt, reduceMotion, last.rainfall);
    landscape.river.frame(dt, reduceMotion, last.rainfall);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const t =
      reduceMotion || !duration ? 1 : THREE.MathUtils.clamp(((freezeAt ?? now) - started) / duration, 0, 1);
    const settle =
      streaming && !reduceMotion
        ? 1 - THREE.MathUtils.smoothstep((freezeAt ?? now) - started - duration, 0, 160)
        : 1;
    let shadowCount = 0;

    for (const [kind, draw] of Object.entries(batches)) {
      const near = close[kind],
        distant = far[kind];
      near.length = distant.length = 0;
      for (const a of groups[kind] ?? []) {
        samplePlaybackPose(a, t, duration, settle, reduceMotion);
        a.position.y = landscape.heightAt(a.position.x, a.position.z, a.normal);
        if (a.view === 'tiger' || a.view === 'mugger') {
          const level = landscape.river.levelAt(
            (a.position.x + last.width / 2) * 2,
            (a.position.z + last.height / 2) * 2,
          );
          if (level !== null) {
            a.position.y = level - (a.view === 'mugger' ? 0.42 : 0.87) * a.size;
            a.normal.copy(up);
          }
        }
        const sip = a.action === 'drink',
          travelled = (a.position.x - a.wakeX) ** 2 + (a.position.z - a.wakeZ) ** 2;
        if (
          !reduceMotion &&
          freezeAt === null &&
          t < 1 &&
          now - a.wakeAt > (sip ? 450 : 110) &&
          ((sip && a.weights[3] > 0.6) || (a.action === 'swim' && travelled > 0.1))
        ) {
          const reach = (sip ? 0.92 : -0.62) * a.size;
          landscape.river.field.disturb(
            a.position.x + Math.cos(a.facing) * reach,
            a.position.z - Math.sin(a.facing) * reach,
            sip ? -0.24 : -0.55,
            sip ? 0.9 : 1.1,
          );
          a.wakeAt = now;
          a.wakeX = a.position.x;
          a.wakeZ = a.position.z;
        }
        bounds.center.copy(a.position);
        if (!frustum.intersectsSphere(bounds)) continue;
        if (a.action !== 'swim') {
          pose.position.copy(a.position);
          pose.position.y += 0.027;
          pose.quaternion.setFromUnitVectors(up, a.normal);
          pose.rotateY(a.facing);
          pose.scale.set((kind === 'mugger' ? 3.2 : 2.15) * a.size, 1, 0.78 * a.size);
          pose.updateMatrix();
          shadows.setMatrixAt(shadowCount++, pose.matrix);
        }
        (fine[kind] && camera.position.distanceToSquared(a.position) < (25 * a.size) ** 2 ? near : distant).push(
          a,
        );
      }
      draw(distant);
      fine[kind]?.(near);
    }
    if (shadows) {
      shadows.count = shadowCount;
      shadows.instanceMatrix.needsUpdate = true;
    }
  }
  return {
    update,
    frame,
    freeze(now = performance.now()) {
      freezeAt = now;
    },
    async addDetail(lib, renderer, camera) {
      const prepared = {},
        layer = new THREE.Group();
      register(lib, prepared, layer);
      for (const draw of Object.values(prepared)) draw([], true);
      await renderer.compileAsync(layer, camera, scene);
      const textures = new Set(layer.children.map((mesh) => mesh.material.map).filter(Boolean));
      for (const texture of textures) renderer.initTexture(texture);
      scene.add(layer);
      Object.assign(fine, prepared);
    },
    pick(ray) {
      return landscape.pick(ray);
    },
    get river() {
      return landscape.river;
    },
    get wind() {
      return landscape.wind;
    },
    get ground() {
      return landscape.ground;
    },
    get span() {
      return Math.max(last.width, last.height);
    },
    focus(view, id) {
      if (actors.get(id)?.view === view) return actors.get(id);
      return [...actors.values()].find((a) => a.view === view);
    },
  };
}
