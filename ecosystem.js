import * as THREE from 'three';

const speciesViews = { deer: 'chital', tiger: 'tiger', crocodile: 'mugger' };
const names = { 'Axis axis': 'chital', 'Panthera tigris tigris': 'tiger', 'Crocodylus palustris': 'mugger' };
const up = new THREE.Vector3(0, 1, 0);
const pose = new THREE.Object3D();
const matrix = new THREE.Matrix4();

function tuftGeometry() {
  const vertices = [];
  for (let blade = 0; blade < 9; blade++) {
    const a = blade * 2.4,
      dx = Math.cos(a),
      dz = Math.sin(a),
      h = 0.18 + (blade % 4) * 0.075;
    vertices.push(-dz * 0.035, 0, dx * 0.035, dz * 0.035, 0, -dx * 0.035, dx * h * 0.6, h, dz * h * 0.6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createLandscape(scene, state, tree) {
  const { width: w, height: h, terrain } = state;
  const n = w * h;
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
  const pixels = new Uint8Array(n * 4);
  const map = new THREE.DataTexture(pixels, w, h);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, roughness: 0.92 }));
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
  group.add(ground, cut);
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
    new THREE.MeshStandardMaterial({ color: 0x879659, side: THREE.DoubleSide }),
    clumps.length,
  );
  grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grass.frustumCulled = false;
  group.add(grass);
  if (tree && groves.length) {
    const inverse = tree.matrixWorld.clone().invert();
    tree.traverse((part) => {
      if (!part.isMesh) return;
      const trees = new THREE.InstancedMesh(part.geometry, part.material, groves.length);
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
  function update(s) {
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
          pixels[j] = 148 - 82 * water;
          pixels[j + 1] = 152 - 11 * water;
          pixels[j + 2] = 123 + 12 * water;
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
    clumps.forEach((p, i) => {
      pose.position.set(p.x, p.y, p.z);
      pose.rotation.set(0, p.angle, 0);
      pose.scale.setScalar(Math.min(1.65, Math.max(0.015, s.grass[p.i] / 36)));
      pose.updateMatrix();
      grass.setMatrixAt(i, pose.matrix);
    });
    grass.instanceMatrix.needsUpdate = true;
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
    map.dispose();
  }
  return { ground, surface, update, dispose };
}

// Models share geometry and materials. Each snapshot animal keeps its own position, heading and age.
function animalBatch(scene, root) {
  const parts = [];
  root.traverse((node) => {
    if (node.isMesh) parts.push(node);
  });
  let meshes = [],
    capacity = 0;
  const inverse = new THREE.Matrix4();
  const locals = parts.map(() => new THREE.Matrix4());
  const bounds = new THREE.Sphere(new THREE.Vector3(), 3);
  return function draw(actors, t, frustum) {
    if (actors.length > capacity) {
      for (const m of meshes) {
        scene.remove(m);
        m.dispose();
      }
      capacity = Math.max(16, actors.length * 2);
      meshes = parts.map((p) => {
        const m = new THREE.InstancedMesh(p.geometry, p.material, capacity);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.frustumCulled = false;
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
        return m;
      });
    }
    meshes.forEach((m) => {
      m.count = actors.length;
    });
    if (!actors.length) return;
    inverse.copy(root.matrixWorld).invert();
    parts.forEach((part, j) => locals[j].multiplyMatrices(inverse, part.matrixWorld));
    let visible = 0;
    actors.forEach((actor) => {
      actor.position.lerpVectors(actor.from, actor.to, t);
      bounds.center.copy(actor.position);
      if (!frustum.intersectsSphere(bounds)) return;
      const i = visible++;
      pose.position.copy(actor.position);
      pose.quaternion.setFromAxisAngle(up, actor.heading);
      pose.scale.setScalar(actor.size);
      pose.updateMatrix();
      meshes.forEach((mesh, j) => mesh.setMatrixAt(i, matrix.multiplyMatrices(pose.matrix, locals[j])));
    });
    meshes.forEach((m) => {
      m.count = visible;
      m.instanceMatrix.needsUpdate = true;
    });
  };
}

export function createEcosystem(scene, library) {
  library.updateMatrixWorld(true);
  const batches = {};
  let tree;
  library.traverse((node) => {
    const key = names[node.userData.scientificName];
    if (key) batches[/doe/i.test(node.name) ? 'doe' : key] = animalBatch(scene, node);
    if (!tree && node.userData.name?.startsWith('Sal · broadleaf')) tree = node;
  });
  const eggMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e4b5 });
  const corpseMaterial = new THREE.MeshStandardMaterial({ color: 0x6b5247 });
  const markerGeometry = new THREE.IcosahedronGeometry(1, 1);
  let markers = [];
  let actors = new Map(),
    groups = {},
    landscape,
    last,
    started = 0,
    duration = 0;
  function update(s) {
    const reset =
      !last ||
      s.tick < last.tick ||
      s.seed !== last.seed ||
      s.width !== last.width ||
      s.height !== last.height ||
      s.tick === 0;
    if (reset) {
      landscape?.dispose();
      landscape = createLandscape(scene, s, tree);
      actors.clear();
    }
    landscape.update(s);
    const next = new Map();
    groups = {};
    for (const a of s.animals) {
      const view = speciesViews[a.species];
      const key = view === 'chital' && (a.age < a.mature_age || a.id % 2 === 0) ? 'doe' : view;
      const old = actors.get(a.id);
      const size = a.age >= a.mature_age ? 1 : 0.52 + (0.48 * a.age) / a.mature_age;
      const to = new THREE.Vector3(a.x + 0.5 - s.width / 2, landscape.surface(a.x, a.y), a.y + 0.5 - s.height / 2);
      if (view === 'mugger' && s.water[a.y * s.width + a.x] >= 15) to.y -= 0.23 * size;
      const dx = old ? to.x - old.to.x : 0,
        dz = old ? to.z - old.to.z : 0;
      const actor = {
        id: a.id,
        view,
        size,
        energy: a.energy,
        age: a.age,
        to,
        heading: dx || dz ? Math.atan2(-dz, dx) : (old?.heading ?? a.id * 2.4),
        from: old && !reset && s.tick === last.tick + 1 ? old.position.clone() : to.clone(),
        position: to.clone(),
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
      const m = new THREE.InstancedMesh(markerGeometry, mat, items.length);
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
    started = performance.now();
    duration = !reset && last && s.tick === last.tick + 1 ? 440 : 0;
    last = s;
  }
  const frustum = new THREE.Frustum();
  function frame(now, reduceMotion, camera) {
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    library.updateMatrixWorld(true);
    const t = reduceMotion || !duration ? 1 : Math.min(1, (now - started) / duration);
    for (const [key, draw] of Object.entries(batches)) draw(groups[key] ?? [], Math.max(0, t), frustum);
  }
  return {
    update,
    frame,
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
