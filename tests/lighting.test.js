import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { daylight, caseGlass } from '../lighting.js';
import { animateMaterial } from '../motion.js';

test('rain softens the same sun and the local depth capture adds no illumination', () => {
  const scene = new THREE.Scene(),
    probe = new THREE.DataTexture(null, 336, 256);
  const rig = daylight(scene, 128, 128, probe, true);
  const [sun, near] = scene.children.filter((o) => o.isDirectionalLight && o.castShadow);
  const sky = scene.children.find((o) => o.isHemisphereLight);
  const clear = sun.intensity,
    fill = sky.intensity;
  rig.weather(6, true);
  assert.ok(sun.intensity < clear && sky.intensity > fill);
  assert.equal(near.intensity, 0);
  const camera = new THREE.PerspectiveCamera();
  const target = new THREE.Vector3(12, 0.7, -29);
  camera.position.copy(target).add(new THREE.Vector3(2, 2, 4));
  rig.focus(camera, target);
  assert.equal(near.shadow.intensity, 1);
  const direction = sun.position.clone().normalize();
  assert.ok(near.position.clone().sub(near.target.position).normalize().distanceTo(direction) < 1e-8);
  const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
  const texel = (near.shadow.camera.right - near.shadow.camera.left) / near.shadow.mapSize.x;
  assert.ok(Math.abs(near.target.position.dot(right) / texel - Math.round(target.dot(right) / texel)) < 1e-8);
  camera.position.z += 130;
  rig.focus(camera, target);
  assert.equal(near.shadow.intensity, 0);
  assert.equal(caseGlass(rig.reflection).uniforms.hallRadiance.value, scene.environment);
});

test('shadow depth uses the same per-instance articulation as the shaded skin', () => {
  const depth = animateMaterial(new THREE.MeshDepthMaterial(), 'chital');
  const skin = animateMaterial(new THREE.MeshStandardMaterial(), 'chital');
  const shader = (material) => {
    const src = { vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>' };
    material.onBeforeCompile(src);
    return src.vertexShader;
  };
  const a = shader(skin),
    b = shader(depth);
  assert.equal(
    a.split('void animalPose')[1].split('#include')[0],
    b.split('void animalPose')[1].split('#include')[0],
  );
  assert.match(b, /animalPose\(transformed,depthNormal\)/);
});
