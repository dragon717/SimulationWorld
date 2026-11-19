// Run against an isolated world; BENCH_URL identifies the test server.
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');
const { performance } = require('node:perf_hooks');
const url = process.env.BENCH_URL;
if (!url) throw new Error('Set BENCH_URL to a separate running test world.');
const duration = Number(process.env.BENCH_SECONDS || 12) * 1000;
function stats(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const p = (fraction) => +sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(2);
  return { n: values.length, median: p(0.5), p99: p(0.99), max: p(1) };
}
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || undefined,
    headless: !process.env.HEADED,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      const sample = (window.bench = {
        interval: [],
        cpu: [],
        gpu: [],
        input: [],
        nextFrame: [],
        first: 0,
        active: false,
      });
      const raf = window.requestAnimationFrame.bind(window);
      const context = HTMLCanvasElement.prototype.getContext;
      let gl,
        ext,
        old,
        queued = [],
        waiting = [],
        firstFence;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const c = context.call(this, type, ...rest);
        if (type === 'webgl2' && c && !gl) {
          gl = c;
          ext = c.getExtension('EXT_disjoint_timer_query_webgl2');
          const debug = c.getExtension('WEBGL_debug_renderer_info');
          sample.renderer = debug ? c.getParameter(debug.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER);
        }
        return c;
      };
      // Observe only the application's render loop once the scene has a visible canvas.
      window.requestAnimationFrame = (cb) =>
        raf((t) => {
          if (!document.querySelector('#viewport canvas') || !gl) return cb(t);
          if (firstFence && gl.clientWaitSync(firstFence, 0, 0) !== gl.TIMEOUT_EXPIRED) {
            sample.firstGPU = performance.now();
            gl.deleteSync(firstFence);
            firstFence = null;
          }
          if (!sample.active && sample.first) {
            old = undefined;
            return cb(t);
          }
          let q;
          if (sample.active && ext) {
            if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
              for (const pending of queued) gl.deleteQuery(pending);
              queued = [];
            }
            while (queued.length && gl.getQueryParameter(queued[0], gl.QUERY_RESULT_AVAILABLE)) {
              const done = queued.shift();
              sample.gpu.push(gl.getQueryParameter(done, gl.QUERY_RESULT) / 1e6);
              gl.deleteQuery(done);
            }
            q = gl.createQuery();
            gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          }
          const start = performance.now();
          cb(t);
          const end = performance.now();
          if (q) {
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            queued.push(q);
          }
          if (!sample.first) {
            sample.first = end;
            firstFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
          }
          if (sample.active) {
            if (old !== undefined && t > old) sample.interval.push(t - old);
            sample.cpu.push(end - start);
            old = t;
            for (const ts of waiting) sample.nextFrame.push(end - ts);
            waiting = [];
          }
        });
      document.addEventListener('pointerup', (e) => {
        if (sample.active && e.target.tagName === 'CANVAS') {
          sample.input.push(performance.now() - e.timeStamp);
          waiting.push(e.timeStamp);
        }
      });
    });
    await page.goto(url);
    await page.waitForFunction(() => window.bench.firstGPU, null, { timeout: 90000 });
    await page.locator('#speed').selectOption(process.env.SPEED || '5');
    if (process.env.FOCUS) await page.locator('[data-view="' + process.env.FOCUS + '"]').click();
    await page.waitForTimeout(900);
    const startTick = await page.locator('#tick').textContent();
    let gesture = 0;
    await page.evaluate(() => (window.bench.active = true));
    const box = await page.locator('#viewport canvas').boundingBox();
    const start = performance.now();
    while (performance.now() - start < duration) {
      await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.54);
      await page.mouse.down();
      if (process.env.FOCUS || ++gesture % 2 === 0)
        await page.mouse.move(box.x + box.width * 0.45 + 8, box.y + box.height * 0.54);
      await page.mouse.up();
      await page.waitForTimeout(260);
    }
    const b = await page.evaluate(() => {
      window.bench.active = false;
      return window.bench;
    });
    const fps = (b.interval.length * 1000) / b.interval.reduce((a, v) => a + v, 0);
    const result = {
      renderer: b.renderer,
      version: browser.version(),
      speed: process.env.SPEED || '5',
      view: process.env.FOCUS || 'overview',
      startTick,
      endTick: await page.locator('#tick').textContent(),
      fps: +fps.toFixed(2),
      interval: stats(b.interval),
      renderCPU: stats(b.cpu),
      gpu: stats(b.gpu),
      inputThroughHandler: stats(b.input),
      inputThroughFrameSubmit: stats(b.nextFrame),
      coldFirstSubmit: b.first,
      coldFirstGPUObserved: b.firstGPU,
    };
    result.finalView=await page.locator('[data-view][aria-pressed=true]').getAttribute('data-view',{timeout:250}).catch(()=> 'free');
    result.over16ms = b.interval.filter((v) => v > 16.7).length;
    result.gpuUnder2Pct = b.gpu.length
      ? +((100 * b.gpu.filter((v) => v < 2).length) / b.gpu.length).toFixed(1)
      : null;
    if ((await page.locator('#play').textContent()) === '暂停') await page.locator('#play').click();
    await page.locator('#step:enabled').waitFor();
    await page.evaluate(() => {
      window.stepTimes = [];
      let down;
      document.querySelector('#step').addEventListener('pointerdown', (e) => (down = e.timeStamp));
      new MutationObserver(() => {
        if (down !== undefined) {
          stepTimes.push(performance.now() - down);
          down = undefined;
        }
      }).observe(document.querySelector('#tick'), { childList: true });
    });
    for (let i = 0; i < 24; i++) {
      await page.locator('#step').click();
      await page.waitForFunction((n) => stepTimes.length >= n, i + 1);
    }
    result.stepToDisplayedValue = stats(await page.evaluate(() => stepTimes));
    console.log(JSON.stringify(result));
    if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
