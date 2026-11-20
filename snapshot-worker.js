// Parse the full upstream response away from the render thread and transfer its cell buffers.
self.onmessage = async ({ data: { id, path, session, checkpoint } }) => {
  try {
    const response = await fetch('/api/' + path, {
      method: path === 'state' ? 'GET' : 'POST',
      cache: 'no-store',
      headers: {
        'X-Simulation-Session': session,
        'X-Simulation-Checkpoint': checkpoint,
      },
    });
    if (!response.ok) throw new Error('生态请求失败（HTTP ' + response.status + '）');
    const text = await response.text();
    const state = JSON.parse(text.replace(/("(?:seed|state_hash)"\s*:\s*)(\d+)/g, '$1"$2"'));
    if (!Array.isArray(state.animals) || state.terrain?.length !== state.width * state.height)
      throw new Error('无效的生态快照');
    const buffers = [];
    for (const key of ['terrain', 'water', 'grass', 'nutrient']) {
      state[key] = key === 'terrain' ? Uint8Array.from(state[key]) : Float32Array.from(state[key]);
      buffers.push(state[key].buffer);
    }
    state.history = new Uint32Array(state.samples.length * 4);
    state.samples.forEach((sample, i) => {
      const j = i * 4;
      state.history[j] = sample.tick;
      state.history[j + 1] = sample.deer_pop;
      state.history[j + 2] = sample.tiger_pop;
      state.history[j + 3] = sample.crocodile_pop;
    });
    buffers.push(state.history.buffer);
    state.grassTotal = state.samples.at(-1)?.grass_total ?? state.grass.reduce((a, b) => a + b, 0);
    delete state.samples;
    state.eaters = state.events
      .filter((e) => e.tick === state.tick && e.val > 0 && (e.type === 'hunt' || e.type === 'scavenge'))
      .map((e) => e.a);
    state.events = state.events.slice(-15);
    self.postMessage({ id, state }, buffers);
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
