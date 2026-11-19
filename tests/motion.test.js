import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { activity } from '../motion.js';
import { createEcosystem } from '../ecosystem.js';

const grid = {
  width: 3,
  height: 3,
  water: [0, 100, 0, 0, 0, 0, 0, 0, 0],
  terrain: [0, 1, 0, 0, 0, 0, 0, 0, 0],
  grass: Array(9).fill(30),
};
const deer = { species: 'deer', id: 3, x: 1, y: 1, energy: 51 };
const previous = { cellX: 1, cellY: 1, energy: 49, heading: 0 };
test('feeding, water contact, movement and dry mud select different postures', () => {
  const act = (a, old = previous, events = new Set(), world = grid) =>
    activity(world, a, old, events, { grass: Array(9).fill(32) }).name;
  assert.equal(act(deer), 'feed');
  assert.equal(act({ ...deer, energy: 47 }), 'drink');
  assert.equal(act({ ...deer, energy: 47 }, previous, new Set(), { ...grid, water: Array(9).fill(10) }), 'idle');
  assert.equal(act({ ...deer, x: 2 }), 'walk');
  assert.equal(act({ ...deer, species: 'tiger', y: 0 }), 'swim');
  assert.equal(act({ ...deer, species: 'crocodile', y: 0 }), 'swim');
  assert.equal(act({ ...deer, species: 'crocodile' }, previous, new Set([3])), 'feed');
  assert.equal(act({ ...deer, species: 'crocodile' }), 'idle');
});

test('all playback rates interpolate real consecutive cells and stop at their endpoint', () => {
  for (const speed of [1, 5, 20]) {
    const scene = new THREE.Scene(),
      lib = new THREE.Group(),
      root = new THREE.Group();
    root.userData.scientificName = 'Panthera tigris tigris';
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    lib.add(root);
    const live = createEcosystem(scene, lib),
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 40);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, 0);
    const animal = { ...deer, species: 'tiger', age: 55, mature_age: 30 };
    const state = {
      ...grid,
      tick: 0,
      seed: '7',
      animals: [animal],
      eggs: [],
      corpses: [],
      rainfall: 0,
      nutrient: grid.grass,
    };
    live.update(state);
    live.frame(performance.now(), false, camera);
    live.update({ ...state, tick: 1, animals: [{ ...animal, x: 2 }] }, 1000 / speed);
    const t = performance.now(),
      actor = live.focus('tiger', 3);
    live.frame(t + 500 / speed, false, camera);
    assert.ok(actor.position.x > 0.45 && actor.position.x < 0.55);
    assert.equal(actor.action, 'walk');
    assert.ok(actor.weights[0] > 0);
    live.frame(t + 1000 / speed, false, camera);
    assert.equal(actor.position.x, 1);
    assert.ok(actor.phase > actor.startPhase);
  }
});

test('both shipped libraries include vertex articulation for feet, heads, tails and jaws', () => {
  for (const name of ['habitat-map', 'habitat-detail']) {
    const b = readFileSync(new URL('../assets/' + name + '.glb', import.meta.url));
    const n = b.readUInt32LE(12),
      g = JSON.parse(b.subarray(20, 20 + n)),
      bin = 28 + n;
    const roles = new Set();
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const a = g.accessors[p.attributes._PART],
          v = g.bufferViews[a.bufferView];
        assert.equal(a.componentType, 5126);
        for (let i = 0; i < a.count; i++)
          roles.add(b.readFloatLE(bin + (v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || 4)));
      }
    for (const r of [0, 1, 2, 3, 4, 7]) assert.ok(roles.has(r));
    if (name === 'habitat-detail') assert.ok(roles.has(6));
  }
});

test('cell traversal picks the same visible triangle as the full mesh raycast', () => {
  const live = createEcosystem(new THREE.Scene(), new THREE.Group());
  live.update({
    ...grid,
    seed: '3',
    tick: 0,
    rainfall: 0,
    nutrient: grid.grass,
    animals: [],
    corpses: [],
    eggs: [],
  });
  for (let i = 0; i < 50; i++) {
    const origin = new THREE.Vector3(5 * Math.cos(i), 2 + (i % 5), 5 * Math.sin(i));
    const target = new THREE.Vector3(2 * Math.sin(i * 0.9), 0, 2 * Math.cos(i * 0.6));
    const ray = new THREE.Raycaster(origin, target.sub(origin).normalize());
    const expected = ray.intersectObject(live.ground)[0]?.point;
    const actual = live.pick(ray.ray);
    if (expected) assert.ok(actual && actual.distanceTo(expected) < 1e-5);
    else assert.equal(actual, null);
  }
});
