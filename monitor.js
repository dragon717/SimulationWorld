const species = { deer: ['鹿', '#9e6336'], tiger: ['虎', '#b8491c'], crocodile: ['鳄', '#356255'] };
const events = {
  born: '出生',
  died: '死亡',
  hatched: '孵化',
  lay_egg: '产卵',
  hunt: '捕猎',
  scavenge: '食腐',
  corpse_decayed: '遗骸分解',
  season_changed: '季节更替',
};
export function monitor() {
  const aside = document.querySelector('#monitor');
  aside.hidden = false;
  const graph = aside.querySelector('#history'),
    ctx = graph.getContext('2d');
  const map = aside.querySelector('#world-map'),
    mc = map.getContext('2d');
  const field = aside.querySelector('#map-field').getContext('2d');
  let state,
    kind = 'deer',
    image;
  function chart() {
    if (!state) return;
    const samples = state.history,
      channel = { deer: 1, tiger: 2, crocodile: 3 }[kind],
      w = graph.width,
      h = graph.height;
    ctx.clearRect(0, 0, w, h);
    let ceiling = 1;
    const first = samples[0] ?? state.tick;
    for (let i = channel; i < samples.length; i += 4) ceiling = Math.max(ceiling, samples[i]);
    ctx.strokeStyle = '#c7cbbd';
    ctx.beginPath();
    for (const y of [1, h / 2, h - 1]) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = species[kind][1];
    for (let i = 0; i < samples.length; i += 4) {
      const x = ((samples[i] - first) * (w - 2)) / Math.max(1, state.tick - first) + 1,
        y = h - 2 - ((h - 4) * samples[i + channel]) / ceiling;
      if (i === 0) {
        ctx.moveTo(x, y);
        ctx.fillStyle = species[kind][1];
        ctx.fillRect(x - 1, y - 1, 2, 2);
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    document.querySelector('#range').textContent =
      '第 ' + first + '–' + state.tick + ' 步 · 纵轴 0–' + ceiling + ' 只';
  }
  aside.querySelectorAll('[data-series]').forEach(
    (b) =>
      (b.onclick = () => {
        kind = b.dataset.series;
        aside.querySelectorAll('[data-series]').forEach((k) => k.setAttribute('aria-pressed', String(k === b)));
        chart();
      }),
  );
  function update(s) {
    state = s;
    chart();
    document.querySelector('#grass-total').textContent = Math.round(s.grassTotal).toLocaleString();
    document.querySelector('#world-hash').textContent = BigInt(s.state_hash).toString(16).padStart(16, '0');
    const log = aside.querySelector('ol');
    const rows = s.events
      .slice(-15)
      .reverse()
      .map((e) => {
        const li = document.createElement('li');
        let label = events[e.type] ?? e.type;
        if (e.type === 'hunt') label += e.val > 0 ? '成功' : '未命中';
        if (e.type === 'died') label += '（' + (['', '饥饿', '年老', '捕食'][e.val] || '其他') + '）';
        li.textContent =
          '第 ' +
          e.tick +
          ' 步 · ' +
          label +
          '　#' +
          e.a +
          (e.b ? ' → #' + e.b : '') +
          '　' +
          Number(e.val.toFixed(2));
        return li;
      });
    log.replaceChildren(...rows);
    if (!image || image.width !== s.width || image.height !== s.height) {
      field.canvas.width = s.width;
      field.canvas.height = s.height;
      image = field.createImageData(s.width, s.height);
    }
    for (let i = 0; i < s.terrain.length; i++) {
      const j = i * 4,
        river = s.terrain[i] === 1,
        wet = river && s.water[i] >= 15;
      image.data[j] = river ? (wet ? 84 : 141) : 170 - s.grass[i] * 0.5;
      image.data[j + 1] = river ? (wet ? 151 : 129) : 170 - s.grass[i] * 0.2;
      image.data[j + 2] = river ? (wet ? 151 : 100) : 115 - s.grass[i] * 0.26;
      image.data[j + 3] = 255;
    }
    field.putImageData(image, 0, 0);
    for (const [items, color] of [
      [s.eggs, '#fff1c1'],
      [s.corpses, '#665045'],
    ]) {
      field.fillStyle = color;
      for (const a of items) field.fillRect(a.x, a.y, 1.7, 1.7);
    }
    for (const a of s.animals) {
      field.fillStyle = species[a.species][1];
      const size = a.age < a.mature_age ? 1 : 2;
      field.fillRect(a.x, a.y, size, size);
    }
  }
  function footprint(points) {
    mc.clearRect(0, 0, map.width, map.height);
    if (!state || points.length !== 4) return;
    mc.beginPath();
    for (const [x, z] of points)
      mc.lineTo((x / state.width + 0.5) * map.width, (z / state.height + 0.5) * map.height);
    mc.closePath();
    mc.strokeStyle = '#fffdf3';
    mc.lineWidth = 2;
    mc.stroke();
  }
  return { update, footprint };
}
