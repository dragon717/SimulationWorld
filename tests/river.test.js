import test from 'node:test';
import assert from 'node:assert/strict';
import { waterSurface } from '../river.js';
import { breeze } from '../environment.js';

function channel(levels = Array(40).fill(100)) {
  const wind = breeze(21);
  const river = waterSurface(
    8,
    5,
    (x, z) => [x * 0.4, 0, z * 0.4],
    (x, z) => z * 8 + x,
    levels,
    wind,
  );
  return { wind, river, f: river.field };
}
const peak = (f) => Math.max(...f.height.map(Math.abs));

test('localized momentum propagates across wet faces, conserves displaced volume and damps away', () => {
  const { f } = channel();
  f.disturb(0.3, 0.75, -0.85, 0.74);
  const i = Array.from(f.mass.keys()).find((k) => f.points[k * 3] > 2 && f.points[k * 3 + 2] === 0);
  assert.equal(f.velocity[i], 0);
  for (let t = 0; t < 65; t++) f.step(0, 0, 0);
  const volume = f.height.reduce((sum, h, j) => sum + h * f.mass[j], 0);
  assert.ok(Math.abs(volume) < 1e-6);
  assert.ok(Math.abs(f.height[i]) > 1e-7);
  const before = peak(f);
  for (let t = 0; t < 400; t++) f.step(0, 0, 0);
  assert.ok(peak(f) < before * 0.08);
});
test('a dry channel section blocks waves and dries out its exposed surface', () => {
  const { f, river } = channel();
  const water = Array.from({ length: 40 }, (_, i) => (i % 8 === 4 ? 10 : 100));
  river.configure(water);
  assert.equal(river.levelAt(4.5, 2.5), null);
  f.disturb(0.4, 0.8, -0.9, 0.65);
  for (let t = 0; t < 100; t++) f.step(0, 0, 0);
  for (let i = 0; i < f.height.length; i++) if (f.points[3 * i] >= 2.01) assert.equal(f.height[i], 0);
  river.configure(Array(40).fill(100));
  assert.ok(river.levelAt(4.5, 2.5) !== null);
});
test('wind drives water at rest and reduced motion stops advancement', () => {
  const { river, wind, f } = channel();
  for (let i = 0; i < 120; i++) {
    wind.advance(1 / 120, false);
    river.frame(1 / 120, false);
  }
  assert.ok(peak(f) > 0.001);
  const a = f.height.slice(),
    clock = f.clock;
  wind.advance(1 / 60, true);
  river.frame(1 / 60, true);
  assert.equal(f.clock, clock);
  assert.deepEqual(f.height, a);
});
test('fixed-step water gives the same result at 60 and 120 display frames per second', () => {
  const a = channel(),
    b = channel();
  for (const c of [a, b]) c.f.disturb(0.8, 0.8, -0.7, 0.75);
  for (let i = 0; i < 60; i++) a.river.frame(1 / 60, false);
  for (let i = 0; i < 120; i++) b.river.frame(1 / 120, false);
  assert.equal(a.f.clock, b.f.clock);
  assert.deepEqual(a.f.height, b.f.height);
});

test('backend depth changes the resting surface and wave speed before the bank dries', () => {
  const {river,f} = channel();
  const full = river.levelAt(3.5, 2.5);
  const stiffness = f.stiffness[0];
  river.configure(Array(40).fill(30));
  assert.ok(Math.abs((full-river.levelAt(3.5,2.5))-.091)<1e-6);
  assert.ok(f.stiffness[0]<stiffness);
});
