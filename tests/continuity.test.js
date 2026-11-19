import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEcosystem } from '../ecosystem.js';

function herd() {
  const scene = new THREE.Scene(),
    lib = new THREE.Group(),
    tiger = new THREE.Group();
  tiger.userData.scientificName = 'Panthera tigris tigris';
  tiger.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  lib.add(tiger);
  const live = createEcosystem(scene, lib),
    camera = new THREE.PerspectiveCamera(55, 1, 0.01, 80);
  camera.position.set(0, 6, 12);
  camera.lookAt(0, 0, 0);
  const grid = {
    width: 9,
    height: 9,
    seed: '12',
    terrain: Array(81).fill(0),
    water: Array(81).fill(0),
    grass: Array(81).fill(30),
    nutrient: Array(81).fill(30),
    rainfall: 0,
    corpses: [],
    eggs: [],
  };
  function accept(tick, x, y, ms) {
    live.update(
      { ...grid, tick, animals: [{ id: 1, species: 'tiger', x, y, age: 120, mature_age: 90, energy: 60 }] },
      1000,
      true,
      ms,
    );
  }
  function render(ms) {
    live.frame(ms, false, camera);
    return live.focus('tiger', 1);
  }
  return { accept, render, live, camera };
}

test('1×: jittered arrivals preserve the displayed pose and stride, including the real corner cell', () => {
  const h = herd();
  h.accept(0, 2, 4, 0);
  h.render(0);
  h.accept(1, 3, 4, 1000);
  let last = h.render(1000),
    x = last.position.x,
    phase = last.phase;
  for (let ms = 1010; ms <= 3050; ms += 10) {
    if (ms === 2050 || ms === 2980) {
      const before = last.position.clone(),
        oldPhase = last.phase;
      if (ms === 2050) h.accept(2, 4, 4, ms);
      else h.accept(3, 4, 5, ms);
      assert.ok(h.live.focus('tiger', 1).position.distanceTo(before) < 1e-8);
      assert.equal(h.live.focus('tiger', 1).phase, oldPhase);
    }
    last = h.render(ms);
    if (ms !== 2050 && ms !== 2980 && ms < 2980) {
      assert.ok(last.position.x > x && last.position.x - x < 0.02, 'no freeze or snap on a straight run');
      assert.ok(last.phase > phase);
    }
    x = last.position.x;
    phase = last.phase;
  }
  for (let ms = 3060; ms <= 4300; ms += 10) {
    const a = h.render(ms);
    assert.ok(Math.abs(a.position.x) < 1e-7 || Math.abs(a.position.z) < 1e-7, 'never shortcut across the corner');
    assert.ok(a.position.z >= 0 && a.position.z <= 1);
  }
  assert.equal(last.position.z, 1);
});

test('1×: stopping completes the last confirmed edge and turning follows the shortest arc', () => {
  const h = herd();
  h.accept(0, 2, 4, 0);
  h.render(0);
  h.accept(1, 3, 4, 1000);
  h.render(1800);
  h.accept(2, 3, 4, 1810);
  assert.ok(Math.abs(h.render(2250).position.x + 1) < 1e-7);
  const still = h.render(3200);
  assert.equal(still.position.x, -1);
  const start = still.facing;
  h.accept(3, 2, 4, 3210);
  const a = h.render(3240);
  assert.ok(Math.abs(a.facing - start) < 0.15);
  assert.ok(Math.abs(h.render(3700).facing - start) <= Math.PI + 1e-7);
});

test('a late packet never sends an animal beyond its confirmed cell; pausing holds its actual pose', () => {
  const h = herd();
  h.accept(0, 2, 4, 0);
  h.render(0);
  h.accept(1, 3, 4, 1000);
  const a = h.render(2210);
  assert.equal(a.position.x, -1);
  const saved = [a.phase, a.facing, ...a.weights];
  h.live.freeze(2210);
  const held = h.render(2800);
  assert.deepEqual([held.phase, held.facing, ...held.weights], saved);
  assert.equal(held.position.x, -1);
});
