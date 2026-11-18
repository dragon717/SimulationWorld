import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function openHabitat() {
  const viewport = document.querySelector('#viewport');
  const buttons = [...document.querySelectorAll('button[data-view]')];
  const gltf = await new GLTFLoader().loadAsync('./assets/rapti-floodplain.glb');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6da);
  scene.add(gltf.scene, new THREE.HemisphereLight(0xfff7e4, 0xb4b59e, 2.0));
  const key = new THREE.DirectionalLight(0xffedd0, 2.8);
  key.position.set(-9, 17, 10);
  key.castShadow = true;
  Object.assign(key.shadow.camera, {left:-13, right:13, top:13, bottom:-13, near:1, far:45});
  key.shadow.mapSize.set(2048,2048);
  key.shadow.normalBias = .012;
  scene.add(key);
  gltf.scene.traverse(node => {
    if (node.isMesh) node.castShadow = node.receiveShadow = true;
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400,400),
    new THREE.MeshStandardMaterial({color:0xe5dfd0, roughness:1}));
  floor.rotation.x = -Math.PI/2;
  floor.position.y = -1.32;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(34, 1, .04, 250);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label','河漫滩三维观察区');
  const controls = new OrbitControls(camera,canvas);
  controls.minDistance = .7;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI*.476;
  controls.enablePan = false;
  const mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) mixer.clipAction(clip).play();
  const watcher = matchMedia('(prefers-reduced-motion: reduce)');
  const home = 'habitat';
  const scientificNames = {chital:'Axis axis', tiger:'Panthera tigris tigris', mugger:'Crocodylus palustris'};
  const aims = {};
  gltf.scene.traverse(node => {
    for (const [id, latin] of Object.entries(scientificNames)) {
      if (node.userData.scientificName === latin && !/doe/i.test(node.name)) aims[id] = node;
    }
  });
  let active = home;
  function choose(view) {
    active = view;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    const aspect = Math.min(1, camera.aspect / 1.50);
    if (view === home) {
      controls.target.set(0,1.2,-.2);
      camera.position.copy(controls.target).add(new THREE.Vector3(5.2,14,23).divideScalar(aspect));
    } else {
      const animal = aims[view];
      const center = new THREE.Box3().setFromObject(animal).getCenter(new THREE.Vector3());
      const offset = new THREE.Vector3(view === 'mugger' ? 1.4 : 1.9, view === 'mugger' ? 2.0 : 1.08,
        view === 'mugger' ? 4.1 : 3.7).applyQuaternion(animal.getWorldQuaternion(new THREE.Quaternion()));
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(offset,1/aspect);
    }
    controls.update();
  }
  function resize() {
    const {width,height} = viewport.getBoundingClientRect();
    renderer.setSize(width,height,false);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
  }
  resize();
  choose(home);
  const ground = gltf.scene.getObjectByName('Floodplain_ground_and_riverbed');
  const river = gltf.scene.getObjectByName('Jade_channel');
  const ray = new THREE.Raycaster();
  let press;
  canvas.addEventListener('pointerdown', e => {press = e.isPrimary ? [e.clientX,e.clientY] : null;});
  canvas.addEventListener('pointercancel', () => {press=null;});
  canvas.addEventListener('pointerup', e => {
    if (!press || e.button !== 0 || Math.hypot(e.clientX-press[0],e.clientY-press[1]) > 4) return;
    press=null;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
    const hit = ray.intersectObjects([ground,river])[0];
    if (!hit) return;
    camera.position.add(hit.point.clone().sub(controls.target));
    controls.target.copy(hit.point);
    controls.update();
    active = null;
    for (const b of buttons) b.setAttribute('aria-pressed','false');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Home') {e.preventDefault(); choose(home);}
  });
  for (const b of buttons) {
    b.disabled = false;
    b.addEventListener('click',() => choose(b.dataset.view));
  }
  viewport.prepend(canvas);
  viewport.querySelector('img').hidden = true;
  document.querySelector('#status').hidden = true;
  new ResizeObserver(() => {resize(); if (active) choose(active);}).observe(viewport);
  let last = performance.now();
  renderer.setAnimationLoop(now => {
    if (!document.hidden && !watcher.matches) mixer.update(Math.min((now-last)/1000,.08));
    last=now;
    renderer.render(scene,camera);
  });
}
