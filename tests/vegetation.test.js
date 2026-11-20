import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { grassTracks, growSal, meadow } from '../vegetation.js';
import { breeze } from '../environment.js';

test('each blade has one fixed root and emergence rank; crossed photo cards grow as one tuft', () => {
  const group = new THREE.Group();
  const field = meadow(
    group,
    { width: 1, height: 1, terrain: [0], seed: 1 },
    (_, __, normal) => {
      normal.set(0, 1, 0);
      return 0;
    },
    null,
    breeze(1),
    null,
    new THREE.Texture(),
  );
  field.frame(new THREE.PerspectiveCamera(), new THREE.Frustum());
  const blades = group.getObjectByName('近岸细草').geometry;
  const roots = blades.getAttribute('grassRoot'),
    ranks = new Set();
  for (let i = 0; i < blades.index.count; i += 3) {
    const a = blades.index.getX(i);
    ranks.add(roots.getZ(a));
    for (const b of [blades.index.getX(i + 1), blades.index.getX(i + 2)]) {
      assert.equal(roots.getX(a), roots.getX(b));
      assert.equal(roots.getY(a), roots.getY(b));
      assert.equal(roots.getZ(a), roots.getZ(b));
    }
  }
  assert.ok(ranks.size > 2 && Math.min(...ranks) < 0.1 && Math.max(...ranks) > 0.9);
  const cards = group.getObjectByName('漫滩草甸').geometry.getAttribute('grassRoot');
  for (let i = 0; i < cards.count; i++) assert.equal(cards.getZ(i), -1);
  field.dispose();
});

test('a moving animal parts nearby blades in its direction and the track fully recovers', () => {
  const tracks = grassTracks(8, 8);
  const pixels = tracks.texture.image.data;
  const center = (8 * 16 + 8) * 2;
  tracks.brush(0.25, 0.25, 1, 0, 1);
  assert.ok(pixels[center] > 245);
  assert.equal(pixels[center + 1], 128);
  assert.equal(pixels[0], 128);
  tracks.advance(0.1);
  assert.ok(pixels[center] < 245 && pixels[center] > 128);
  tracks.brush(0.25, 0.25, -1, 0, 1);
  assert.ok(pixels[center] < 16);
  for (let i = 0; i < 100; i++) tracks.advance(0.05);
  assert.ok(pixels.every((x) => x === 128));
  tracks.brush(4, -4, 0, 0, 1);
  assert.ok(pixels.every((x) => x === 128));
});

test('rain grows and refoliates sal, drought thins crowns gradually and pause preserves both states', () => {
  const site = { size: 0.46, cell: 0, bank: 0.5 };
  const rain = { tick: 0, season: 'wet_peak', rainfall: 4, temperature: 27, nutrient: [66] };
  const drought = { ...rain, season: 'dry_late', rainfall: 0.1, temperature: 36 };
  growSal(site, rain, null);
  const wet = site.leaf;
  const drierSite = { ...site };
  growSal(site, rain, 70);
  growSal(drierSite, drought, 70);
  assert.ok(site.size > drierSite.size && drierSite.size >= 0.46);
  assert.ok(drierSite.leaf < wet * 0.35);
  const dry = { ...drierSite };
  growSal(drierSite, rain, 0);
  assert.deepEqual(drierSite, dry);
  growSal(drierSite, rain, 1);
  assert.ok(drierSite.leaf > dry.leaf && drierSite.leaf < wet);
  growSal(drierSite, rain, 70);
  assert.ok(drierSite.leaf > 0.9 * wet);
});

test('wind preview and reduced motion apply to the shared wind field', () => {
  const wind = breeze(90);
  wind.strength = 0;
  wind.advance(0.03, false, 4);
  assert.equal(wind.uniforms.windGust.value, 0);
  wind.strength = 1.8;
  wind.advance(0.03, false, 4);
  assert.ok(wind.uniforms.windGust.value > 1);
  wind.advance(0.03, true, 4);
  assert.equal(wind.uniforms.windGust.value, 0);
});
