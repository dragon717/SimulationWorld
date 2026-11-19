import * as THREE from 'three';
import { waterSurface } from './river.js';

export function breeze(seed = 0) {
  const uniforms = {
    windTime: { value: 0 },
    windDir: { value: new THREE.Vector2(0.86, 0.51) },
    windGust: { value: 0.7 },
  };
  let time = 0;
  const phase = (Number(BigInt(seed) % 997n) / 997) * Math.PI * 2;
  return {
    uniforms,
    advance(dt, reduced, rain = 0) {
      if (reduced) {
        uniforms.windGust.value = 0;
        return;
      }
      time += Math.min(0.08, dt);
      const angle = 0.48 + 0.42 * Math.sin(time * 0.13 + phase) + 0.13 * Math.sin(time * 0.37);
      uniforms.windDir.value.set(Math.cos(angle), Math.sin(angle));
      uniforms.windTime.value = time;
      uniforms.windGust.value =
        0.76 + 0.28 * Math.sin(time * 0.72 + phase) + 0.12 * Math.sin(time * 1.42) + Math.min(0.3, rain * 0.045);
    },
  };
}

export function bendGrass(material, wind, instanced) {
  const result = material.clone();
  result.customProgramCacheKey = () => (instanced ? 'field-wind' : 'herbarium-wind');
  result.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, wind.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      uniform float windTime,windGust;uniform vec2 windDir;
      ${instanced ? '' : 'attribute float bladeRise;'}`,
      )
      .replace(
        '#include <project_vertex>',
        `
        ${instanced ? 'vec4 wp=modelMatrix*instanceMatrix*vec4(transformed,1.);float h=max(0.,position.y*length(instanceMatrix[1].xyz));' : 'vec4 wp=modelMatrix*vec4(transformed,1.);float h=bladeRise;'}
        float phase=dot(wp.xz,windDir);
        float gust=.63+.30*sin(phase*1.24-windTime*3.1)+.16*sin(phase*2.6+wp.z*.8-windTime*4.7);
        float bend=h*h/(.19+h)*windGust;
        wp.xz+=bend*(windDir*gust+vec2(-windDir.y,windDir.x)*.11*sin(wp.x*2.7-windTime*3.));
        wp.y-=bend*.16*gust*gust;
        vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;`,
      );
  };
  return result;
}

// Sample the authored riverbed triangles to pin grass roots and bend reed plumes with their stalks.
function groundSampler(mesh) {
  const g = mesh.geometry,
    pos = g.attributes.position,
    idx = g.index;
  const bins = new Map();
  for (let j = 0; j < (idx?.count ?? pos.count); j += 3) {
    const ids = [0, 1, 2].map((k) => (idx ? idx.getX(j + k) : j + k));
    const xs = ids.map((i) => pos.getX(i)),
      zs = ids.map((i) => pos.getZ(i));
    for (let z = Math.floor(Math.min(...zs)); z <= Math.floor(Math.max(...zs)); z++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++) {
        const key = x + ',' + z;
        if (!bins.has(key)) bins.set(key, []);
        bins.get(key).push(ids);
      }
  }
  return (x, z) => {
    for (const [a, b, c] of bins.get(Math.floor(x) + ',' + Math.floor(z)) ?? []) {
      const dx = x - pos.getX(a),
        dz = z - pos.getZ(a),
        bx = pos.getX(b) - pos.getX(a),
        bz = pos.getZ(b) - pos.getZ(a);
      const cx = pos.getX(c) - pos.getX(a),
        cz = pos.getZ(c) - pos.getZ(a);
      const det = bx * cz - bz * cx;
      if (Math.abs(det) < 1e-10) continue;
      const u = (dx * cz - dz * cx) / det,
        v = (bx * dz - bz * dx) / det;
      if (u >= -0.00001 && v >= -0.00001 && u + v <= 1.00001)
        return (1 - u - v) * pos.getY(a) + u * pos.getY(b) + v * pos.getY(c);
    }
    return 0;
  };
}

export function animateOriginal(root) {
  const wind = breeze(284),
    ground = root.getObjectByName('Floodplain_ground_and_riverbed');
  const height = groundSampler(ground);
  root.traverse((mesh) => {
    if (!mesh.isMesh || !/^(Grassland|Kans grass)/.test(mesh.userData.name ?? '')) return;
    const p = mesh.geometry.attributes.position,
      rise = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) rise[i] = Math.max(0, p.getY(i) - height(p.getX(i), p.getZ(i)));
    mesh.geometry.setAttribute('bladeRise', new THREE.BufferAttribute(rise, 1));
    mesh.material = bendGrass(mesh.material, wind, false);
    mesh.customDepthMaterial = bendGrass(
      new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }),
      wind,
      false,
    );
  });
  const old = root.getObjectByName('Jade_channel'),
    p = old.geometry.attributes.position,
    columns = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    if (!columns.has(x)) columns.set(x, [z, z]);
    const col = columns.get(x);
    col[0] = Math.min(col[0], z);
    col[1] = Math.max(col[1], z);
  }
  const rows = [...columns].sort((a, b) => a[0] - b[0]),
    across = 16;
  const river = waterSurface(
    rows.length - 1,
    across,
    (x, z) => {
      const [px, [lo, hi]] = rows[x];
      return [px, 0.004, lo + ((hi - lo) * z) / across];
    },
    () => 0,
    [100],
    wind,
    height,
  );
  old.visible = false;
  const glints = root.getObjectByName('Fine_surface_currents');
  if (glints) glints.visible = false;
  old.parent.add(river.mesh);
  let croc;
  root.traverse((n) => {
    if (n.userData.scientificName === 'Crocodylus palustris') croc = n;
  });
  const rest = croc?.position.y;
  const gx = croc ? ((croc.position.x - rows[0][0]) / (rows.at(-1)[0] - rows[0][0])) * (rows.length - 1) : 0;
  const column = rows[Math.min(rows.length - 1, Math.max(0, Math.round(gx)))][1];
  const gz = croc ? ((croc.position.z - column[0]) / (column[1] - column[0])) * across : 0;
  return {
    river,
    wind,
    frame(dt, reduced) {
      wind.advance(dt, reduced);
      river.frame(dt, reduced);
      if (croc) croc.position.y = rest + (river.levelAt(gx, gz) ?? 0.004) - 0.004;
    },
  };
}
