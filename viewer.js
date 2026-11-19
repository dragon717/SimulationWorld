import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createEcosystem } from './ecosystem.js';
import { monitor } from './monitor.js';
import { animateOriginal } from './environment.js';
import { actionNames } from './motion.js';
import { connectSimulation, snapshot } from './simulation.js';

export async function openHabitat() {
  const viewport = document.querySelector('#viewport');
  const buttons = [...document.querySelectorAll('button[data-view]')];
  const simulated = new URLSearchParams(location.search).get('view') !== 'habitat';
  const loader = new GLTFLoader();
  const loading = Promise.all([
    loader.loadAsync(simulated ? './assets/habitat-map.glb' : './assets/rapti-floodplain.glb'),
    simulated ? snapshot() : null,
  ]);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: !simulated,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, simulated ? 1.25 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = !simulated;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = simulated ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  renderer.setClearColor(0x101c20, 0);
  scene.add(new THREE.HemisphereLight(0xfff7e4, 0xb4b59e, 2.0));
  const [gltf, initial] = await loading;
  const live = simulated ? createEcosystem(scene, gltf.scene) : null;
  if (!live) scene.add(gltf.scene);
  const original = live ? null : animateOriginal(gltf.scene);
  const key = new THREE.DirectionalLight(0xffedd0, 2.8);
  key.position.set(-9, 17, 10);
  if (live) key.position.multiplyScalar(7);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
  if (live) {
    const span = Math.max(initial.width, initial.height) * 0.8;
    Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: 350 });
  }
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.mapSize.set(live ? 1024 : 2048, live ? 1024 : 2048);
  key.shadow.normalBias = 0.012;
  scene.add(key);
  gltf.scene.traverse((node) => {
    if (node.isMesh) node.castShadow = node.receiveShadow = true;
  });
  const w = live ? initial.width + 2 : 19.1,
    d = live ? initial.height + 2 : 13.7;
  const caseHeight = live ? Math.max(8, w * 0.105) : 6.6;
  const seat = live ? -1.425 : -1.32;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w + 1, w * 0.029, d + 1),
    new THREE.MeshStandardMaterial({ color: 0x27393b, roughness: 0.48, metalness: 0.29 }),
  );
  plinth.position.y = seat - w * 0.0145;
  plinth.castShadow = plinth.receiveShadow = true;
  scene.add(plinth);
  const standHeight = w * 0.065;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, standHeight, d * 0.8), plinth.material);
  stand.position.y = seat - w * 0.029 - standHeight * 0.5;
  stand.castShadow = stand.receiveShadow = true;
  scene.add(stand);
  const enclosure = new THREE.BoxGeometry(w, caseHeight, d);
  const glass = new THREE.Mesh(
    enclosure,
    new THREE.MeshBasicMaterial({
      color: 0xa1dddf,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      side: THREE.FrontSide,
    }),
  );
  const seams = new THREE.LineSegments(
    new THREE.EdgesGeometry(enclosure),
    new THREE.LineBasicMaterial({ color: 0xb6e4e2, transparent: true, opacity: 0.36, depthWrite: false }),
  );
  glass.position.y = seams.position.y = seat + caseHeight * 0.5;
  glass.renderOrder = 4;
  seams.renderOrder = 5;
  scene.add(glass, seams);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(440, 440), new THREE.ShadowMaterial({ opacity: 0.26 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = seat - w * 0.029 - standHeight - 0.008;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.04, live ? 1600 : 250);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '河漫滩三维观察区');
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 0.7;
  controls.maxDistance = live ? 1200 : 100;
  controls.maxPolarAngle = Math.PI * 0.476;
  controls.enablePan = false;
  const mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) mixer.clipAction(clip).play();
  const watcher = matchMedia('(prefers-reduced-motion: reduce)');
  const home = 'habitat';
  const scientificNames = { chital: 'Axis axis', tiger: 'Panthera tigris tigris', mugger: 'Crocodylus palustris' };
  const aims = {};
  gltf.scene.traverse((node) => {
    for (const [id, latin] of Object.entries(scientificNames)) {
      if (node.userData.scientificName === latin && !/doe/i.test(node.name)) aims[id] = node;
    }
  });
  let active = home,
    followedId;
  const trackedCenter = new THREE.Vector3();
  const nextCenter = new THREE.Vector3();
  const offsetChange = new THREE.Vector3();
  const individual = document.querySelector('#individual');
  let inspected;
  function choose(view) {
    active = view;
    individual.hidden = true;
    inspected = null;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    const aspect = Math.min(1, camera.aspect / 1.5);
    if (view === home) {
      followedId = undefined;
      const direction = new THREE.Vector3(0.2, live ? 0.72 : 0.64, 1).normalize();
      const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
      const vertical = direction.clone().cross(right);
      const base = seat - w * 0.029 - standHeight;
      controls.target.set(0, (base + seat + caseHeight) / 2, 0);
      const halfHeight = (seat + caseHeight - base) / 2,
        tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      let fit = 0;
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            const corner = new THREE.Vector3((x * (w + 1)) / 2, y * halfHeight, (z * (d + 1)) / 2);
            fit = Math.max(
              fit,
              corner.dot(direction) +
                Math.max(
                  Math.abs(corner.dot(vertical)) / tanV,
                  Math.abs(corner.dot(right)) / (tanV * camera.aspect),
                ),
            );
          }
      camera.position.copy(controls.target).addScaledVector(direction, fit * 1.09);
    } else if (live) {
      const a = live.focus(view, followedId);
      if (!a) return choose(home);
      loadDetail();
      followedId = a.id;
      trackedCenter.copy(a.position);
      trackedCenter.y += (view === 'mugger' ? 0.24 : 0.85) * a.size;
      controls.target.copy(trackedCenter);
      const offset = new THREE.Vector3(1.9, view === 'mugger' ? 2.15 : 1.35, 4.4).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        a.heading,
      );
      camera.position.copy(trackedCenter).addScaledVector(offset, a.size / aspect);
    } else {
      const animal = aims[view];
      const center = new THREE.Box3().setFromObject(animal).getCenter(new THREE.Vector3());
      const offset = new THREE.Vector3(
        view === 'mugger' ? 1.4 : 1.9,
        view === 'mugger' ? 2.0 : 1.08,
        view === 'mugger' ? 4.1 : 3.7,
      ).applyQuaternion(animal.getWorldQuaternion(new THREE.Quaternion()));
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(offset, 1 / aspect);
    }
    controls.update();
  }
  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  let prior,
    board,
    monitorTimer,
    lastMonitor = -Infinity,
    lastFoot = -Infinity;
  const cornerRays = new THREE.Raycaster(),
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function footprint(now) {
    if (!board || now - lastFoot < 100) return;
    lastFoot = now;
    const points = [];
    for (const [x, y] of [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      cornerRays.setFromCamera({ x, y }, camera);
      const v =
        cornerRays.ray.intersectPlane(groundPlane, new THREE.Vector3()) ||
        cornerRays.ray.at(camera.far, new THREE.Vector3());
      points.push([v.x, v.z]);
    }
    board.footprint(points);
  }
  let detail;
  function loadDetail() {
    if (!live || detail) return;
    detail = loader
      .loadAsync('./assets/habitat-detail.glb')
      .then((g) => live.addDetail(g.scene, renderer, camera))
      .catch((e) => {
        detail = null;
        console.error(e);
      });
  }
  controls.addEventListener('change', () => {
    if (live && camera.position.distanceTo(controls.target) < 35) loadDetail();
  });
  if (live) {
    document.querySelector('#simulation').hidden = false;
    board = monitor();
    connectSimulation(
      initial,
      (state, interval) => {
        live.update(state, interval);
        const now = performance.now();
        if (!prior || now - lastMonitor >= 100 || interval === 0 || state.tick <= prior.tick) {
          clearTimeout(monitorTimer);
          monitorTimer = null;
          board.update(state);
          lastMonitor = now;
        } else if (!monitorTimer) {
          monitorTimer = setTimeout(
            () => {
              monitorTimer = null;
              board.update(prior);
              lastMonitor = performance.now();
            },
            100 - (now - lastMonitor),
          );
        }
        if (!prior || state.seed !== prior.seed || state.tick <= prior.tick) renderer.shadowMap.needsUpdate = true;
        if (prior && (state.seed !== prior.seed || state.tick < prior.tick)) choose(home);
        prior = state;
      },
      () => live.freeze(),
    );
  } else {
    document.querySelector('#mode').href = './';
    document.querySelector('#mode').textContent = '进入生态模拟';
  }
  choose(home);
  const ground = gltf.scene.getObjectByName('Floodplain_ground_and_riverbed');

  const ray = new THREE.Raycaster();
  let press;
  canvas.addEventListener('pointerdown', (e) => {
    press = e.isPrimary ? [e.clientX, e.clientY] : null;
  });
  canvas.addEventListener('pointercancel', () => {
    press = null;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!press || e.button !== 0 || Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 4) return;
    press = null;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2),
      camera,
    );
    const water = live ? live.river : original.river;
    const land = live ? live.pick(ray.ray) : ray.intersectObject(ground)[0]?.point;
    const wet = ray.intersectObject(water.mesh)[0];
    const touches = wet && (!land || wet.distance <= ray.ray.origin.distanceTo(land) + 0.001);
    const point = touches ? wet.point : land;
    if (touches && !watcher.matches) water.field.disturb(point.x, point.z, -0.82, live ? 1.35 : 0.52);
    if (!point) return;
    camera.position.add(point.clone().sub(controls.target));
    controls.target.copy(point);
    controls.update();
    active = null;
    individual.hidden = true;
    inspected = null;
    for (const b of buttons) b.setAttribute('aria-pressed', 'false');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Home') {
      e.preventDefault();
      choose(home);
    }
  });
  for (const b of buttons) {
    if (!live || b.dataset.view === 'habitat') b.disabled = false;
    b.addEventListener('click', () => choose(b.dataset.view));
  }
  viewport.prepend(canvas);
  viewport.querySelector('img').hidden = true;
  document.querySelector('#status').hidden = true;
  new ResizeObserver(() => {
    resize();
    if (active) choose(active);
  }).observe(viewport);
  const windLabel = document.querySelector('#wind-reading');
  let nextWindLabel = 0;
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    if (document.hidden) {
      last = now;
      return;
    }
    original?.frame(Math.max(0, (now - last) / 1000), watcher.matches);
    if (!watcher.matches) mixer.update(Math.min((now - last) / 1000, 0.08));
    last = now;
    if (live) {
      live.frame(now, watcher.matches, camera);
      footprint(now);
      if (active && active !== home) {
        const actor = live.focus(active, followedId);
        if (!actor) choose(home);
        else if (actor.id !== followedId) choose(active);
        else {
          nextCenter.copy(actor.position);
          nextCenter.y += (active === 'mugger' ? 0.24 : 0.85) * actor.size;
          camera.position.add(offsetChange.subVectors(nextCenter, trackedCenter));
          if (inspected !== actor) {
            individual.textContent =
              '#' +
              actor.id +
              ' · 年龄 ' +
              actor.age +
              ' 步 · 能量 ' +
              actor.energy.toFixed(1) +
              ' · ' +
              actionNames[actor.action];
            individual.hidden = false;
            inspected = actor;
          }
          controls.target.copy(nextCenter);
          trackedCenter.copy(nextCenter);
          controls.update();
        }
      }
    }
    if (now >= nextWindLabel) {
      nextWindLabel = now + 600;
      const u = (live ? live.wind : original.wind).uniforms;
      const a = Math.atan2(u.windDir.value.y, u.windDir.value.x);
      const direction = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'][
        (Math.round((a * 4) / Math.PI) + 8) % 8
      ];
      windLabel.hidden = watcher.matches;
      windLabel.textContent = (u.windGust.value > 1 ? '阵风' : '微风') + ' · 向' + direction;
    }
    const displayDistance = camera.position.distanceTo(controls.target) / w;
    const glassVisibility = THREE.MathUtils.smoothstep(displayDistance, 0.5, 1.25);
    glass.visible = seams.visible = glassVisibility > 0;
    glass.material.opacity = 0.034 * glassVisibility;
    seams.material.opacity = 0.36 * glassVisibility;
    renderer.render(scene, camera);
  });
}
