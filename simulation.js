const seasons = { wet_early: '湿季初期', wet_peak: '湿季盛期', dry_early: '旱季初期', dry_late: '旱季末期' };
const labels = {
  born: '出生',
  died: '死亡',
  lay_egg: '产卵',
  hatched: '孵化',
  hunt: '捕猎',
  scavenge: '食腐',
  corpse_decayed: '遗骸分解',
  season_changed: '季节更替',
};
const $ = (id) => document.getElementById(id);
const session = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
const checkpointKey = 'rapti-ecosim-checkpoint';
let checkpoint = '';
try {
  checkpoint = sessionStorage.getItem(checkpointKey) ?? '';
} catch {
  // The current page can play even when browser storage is unavailable.
}

let worker,
  sequence = 0;
const pending = new Map();
export function snapshot(path = 'state') {
  if (!worker) {
    worker = new Worker('./snapshot-worker.js', { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) {
        job.reject(new Error(data.error));
        return;
      }
      checkpoint = `${data.state.seed}:${data.state.tick}`;
      try {
        sessionStorage.setItem(checkpointKey, checkpoint);
      } catch {
        // Keep the checkpoint in memory if the browser blocks storage.
      }
      job.resolve(data.state);
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error('无法读取生态快照'));
      pending.clear();
      worker.terminate();
      worker = null;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, path, session, checkpoint });
  });
}

export function connectSimulation(initial, apply, freeze) {
  const play = $('play'),
    step = $('step'),
    reset = $('reset'),
    seed = $('seed'),
    speed = $('speed');
  const note = $('sim-note');
  let current,
    playing = false,
    writing = false;
  function display(s, interval = 0, continuous = false) {
    if (current && s.seed === current.seed && s.tick === current.tick && s.state_hash === current.state_hash)
      return;
    apply(s, interval, continuous);
    if (!current || current.seed !== s.seed) seed.value = s.seed;
    current = s;
    const counts = { deer: 0, tiger: 0, crocodile: 0 };
    for (const a of s.animals) counts[a.species]++;
    for (const [view, key] of [
      ['chital', 'deer'],
      ['tiger', 'tiger'],
      ['mugger', 'crocodile'],
    ]) {
      const button = document.querySelector('[data-view="' + view + '"]');
      button.querySelector('small').textContent = counts[key];
      button.disabled = !counts[key];
    }
    $('tick').textContent = String(s.tick);
    $('climate').textContent =
      (seasons[s.season] ?? s.season) +
      ' · ' +
      s.temperature.toFixed(1) +
      ' °C · 降雨 ' +
      s.rainfall.toFixed(1) +
      ' mm';
    $('remains').textContent = '卵 ' + s.eggs.length + ' · 遗骸 ' + s.corpses.length;
    const event = s.events.at(-1);
    $('event').textContent = event
      ? '第 ' +
        event.tick +
        ' 步 · ' +
        (labels[event.type] ?? event.type) +
        (event.type === 'hunt' ? (event.val > 0 ? '成功' : '未命中') : '')
      : '';
  }
  function buttons() {
    play.textContent = playing ? '暂停' : '开始演化';
    play.disabled = writing && !playing;
    step.disabled = reset.disabled = writing;
  }
  async function exclusive(operation) {
    if (writing) return;
    writing = true;
    buttons();
    note.textContent = '';
    try {
      await operation();
    } catch (error) {
      note.textContent = error.message;
    } finally {
      playing = writing = false;
      buttons();
    }
  }
  let held = null;
  async function advanceOnce(path, interval = 0, continuous = false) {
    buttons();
    const state = path === 'step' && held ? held : await snapshot(path);
    // A pause may land while the server is finishing this step. Present it once on resume.
    if (continuous && !playing) {
      held = state;
      return;
    }
    held = null;
    display(state, interval, continuous);
  }
  let wake;
  speed.addEventListener('change', () => wake?.());
  async function autoplay() {
    await exclusive(async () => {
      playing = true;
      buttons();
      while (playing && !document.hidden) {
        const period = 1000 / Number(speed.value),
          begin = performance.now();
        await advanceOnce('step', period, true);
        const remaining = period - (performance.now() - begin);
        if (playing && remaining > 0)
          await new Promise((resolve) => {
            const timer = setTimeout(() => {
              wake = null;
              resolve();
            }, remaining);
            wake = () => {
              clearTimeout(timer);
              wake = null;
              resolve();
            };
          });
      }
    });
  }
  play.onclick = () => {
    if (playing) {
      playing = false;
      wake?.();
      freeze();
      buttons();
    } else autoplay();
  };
  step.onclick = () => exclusive(() => advanceOnce('step', 250));
  reset.onclick = () => {
    const value = seed.value.trim();
    if (!/^\d{1,20}$/.test(value) || BigInt(value) > 18446744073709551615n) {
      note.textContent = '种子须为 0 至 18446744073709551615 之间的整数。';
      return;
    }
    exclusive(() => advanceOnce('reset?seed=' + encodeURIComponent(value)));
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      playing = false;
      wake?.();
      freeze();
    }
  });
  display(initial);
  buttons();
  if (!document.hidden) autoplay();
}
