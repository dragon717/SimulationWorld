// The PMREM was baked from the source HDR offline. Transfer native half-float texels to the renderer.
self.onmessage = async () => {
  try {
    const response = await fetch('./textures/hall-prefiltered.rgba16f.gz');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    let pixels;
    if (typeof DecompressionStream === 'function' && response.body) {
      pixels = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    } else {
      const { gunzipSync } = await import('./node_modules/three/examples/jsm/libs/fflate.module.js');
      pixels = gunzipSync(new Uint8Array(await response.arrayBuffer())).slice().buffer;
    }
    self.postMessage({ pixels }, [pixels]);
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
