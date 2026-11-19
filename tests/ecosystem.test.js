import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEcosystem } from '../ecosystem.js';

test('rendered animals follow snapshot IDs, grid cells, maturity and removal', () => {
  const scene = new THREE.Scene();
  const library = new THREE.Group();
  const stag = new THREE.Group();
  stag.userData.scientificName = 'Axis axis';
  const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  stag.add(body);
  const doe = stag.clone();
  doe.name = 'Chital_doe';
  library.add(stag, doe);
  const live = createEcosystem(scene, library);
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 100);
  camera.position.set(0, 7, 9);
  camera.lookAt(0, 0, 0);
  const state = {
    width:4, height:4, tick:0, seed:'1', terrain:Array(16).fill(0), water:Array(16).fill(0),
    grass:Array(16).fill(35), nutrient:Array(16).fill(40), rainfall:0, eggs:[], corpses:[],
    animals:[{id:1, species:'deer', x:0, y:1, age:45, mature_age:40, energy:72}],
  };
  function render() {
    live.update(state);
    live.frame(performance.now(), true, camera);
    return scene.children.filter(m => m.isInstancedMesh && m.geometry === body.geometry && m.count);
  }
  function position(batch) {
    const m = new THREE.Matrix4();
    batch.getMatrixAt(0, m);
    return [m.elements[12], m.elements[14]];
  }
  assert.deepEqual(position(render()[0]), [-1.5, -.5]);
  state.tick++;
  state.animals[0].x++;
  state.animals[0].energy=63;
  state.animals.push({id:3, species:'deer', x:3, y:2, age:0, mature_age:40, energy:28});
  assert.equal(render().length, 2);
  assert.equal(live.focus('chital', 1).energy, 63);
  assert.deepEqual(position(scene.children.find(m => m.geometry === body.geometry && m.count)), [-.5, -.5]);
  assert.ok(live.focus('chital', 3).size < 1);
  state.tick++;
  state.animals=[];
  assert.equal(render().length, 0);
  assert.equal(live.focus('chital', 1), undefined);
});
