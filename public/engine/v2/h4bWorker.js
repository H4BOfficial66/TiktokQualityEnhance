/**
 * H4B V2 engine worker
 *
 * Runs the ORIGINAL V2 pipeline that method.billoxd.site uses (assets/c-CvVvisn3.js -> patchServerHybrid),
 * with the same fallback order as the original v2Worker.js, but:
 *   - every step is logged honestly (no canned "fake" progress text)
 *   - the final message tells the page WHICH route produced the file, so you can see
 *     immediately if you got a real patched file or a fallback.
 *
 * Routes (best -> worst):
 *   "v3"                     : reconstructed LIVE-site engine (ffmpeg audio re-encode + ghost audio + moov-at-end)
 *   "patch"                  : Te() container patch applied directly to your file
 *   "ffmpeg-prepare+patch"   : file was first normalized with ffmpeg.wasm, then patched
 *   "ffmpeg-stream-copy"     : patch refused the file -> plain ffmpeg stream copy (NOT patched)
 *   "legacy-remux"           : last resort (hybridEngine.js remuxMp4Boxes)
 */

// ---- minimal DOM shim (the bundled vite preload helper touches document/window) -------------
self.window = self;
if (typeof self.document === 'undefined') {
  const stub = () => ({
    rel: '', as: '', crossOrigin: '', href: '',
    setAttribute() {}, getAttribute: () => null,
    addEventListener(type, cb) { if (type === 'load' && typeof cb === 'function') setTimeout(cb, 0); },
    removeEventListener() {},
  });
  self.document = {
    createElement: stub,
    getElementsByTagName: () => [],
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild() {}, removeChild() {} },
    body: { appendChild() {}, removeChild() {} },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 8));
const post = (percent, stage, log) => self.postMessage({ type: 'progress', percent, stage, log });
const STAGE_LABELS = {
  loading: 'Loading video...',
  finalize: 'Preparing container...',
  patching: 'Patching container atoms...',
  downscale: 'Downscaling...',
  processing: 'Processing...',
  'software-compatibility': 'Normalizing format...',
};

function asBlob(res) {
  if (!res) return null;
  if (res.blob instanceof Blob) return res.blob;
  if (res instanceof Blob) return res;
  if (res instanceof Uint8Array) return new Blob([res], { type: 'video/mp4' });
  return null;
}

self.onmessage = async (e) => {
  const { type, buffer, fileName, postingDevice = 'phone', engine = 'v3' } = e.data || {};
  if (type !== 'process' || !buffer || !buffer.byteLength) {
    self.postMessage({ type: 'error', error: 'Invalid input payload or empty video buffer.' });
    return;
  }

  const safeName = typeof fileName === 'string' && fileName ? fileName : 'video.mp4';
  const makeFile = () => new File([buffer], safeName, { type: 'video/mp4' });

  let blob = null;
  let route = '';
  const notes = [];

  try {
    post(5, 'Initializing...', `[*] V2 engine started, posting profile: ${postingDevice}`);
    await tick();

    // ---- 0) v3: reconstructed from the LIVE site output (ffmpeg audio re-encode + container patch) ----
    if (engine === 'v3') {
      try {
        post(10, 'Loading ffmpeg...', '[*] v3: loading ffmpeg.wasm (first run downloads ~32 MB)...');
        await tick();
        const ff = await import('./assets/c-CMiR0szy.js');
        if (typeof ff.runFfmpegJob !== 'function') throw new Error('runFfmpegJob export not found');
        post(15, 'Re-encoding audio...', '[*] v3: ffmpeg  -c:v copy  -c:a aac 192k 48kHz stereo  +faststart');
        const pre = await ff.runFfmpegJob({
          inputFile: makeFile(),
          outputName: 'v3_pre.mp4',
          args: ['-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-c:a', 'aac', '-profile:a', 'aac_low',
                 '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart'],
          onProgress: async (p) => { post(Math.min(80, Math.round(15 + p * 65)), undefined, undefined); await tick(); },
        });
        post(85, 'Patching container...', `[*] v3: ffmpeg done (${pre.byteLength} bytes), applying container patch...`);
        await tick();
        const { patchV3 } = await import('./h4bPatchV3.js');
        const patched = patchV3(pre);
        blob = new Blob([patched], { type: 'video/mp4' });
        route = 'v3';
      } catch (err) {
        const msg = (err && err.message) || String(err);
        notes.push('v3: ' + msg);
        post(30, 'v3 failed, using legacy engine', `[!] v3 engine failed: ${msg}`);
        await tick();
      }
    }

    // ---- 1) primary: original patch pipeline (older snapshot of the V2 engine) -------------------
    if (!blob) try {
      post(10, 'Loading engine...', '[*] Loading primary patch engine (c-CvVvisn3.js)...');
      await tick();
      const mod = await import('./assets/c-CvVvisn3.js');
      const patch = mod.patchServerHybrid || (mod.default && mod.default.patchServerHybrid);
      if (typeof patch !== 'function') throw new Error('patchServerHybrid export not found');

      let finalizeCount = 0;
      const res = await patch(makeFile(), {
        prepare: true,
        postingDevice,
        onProgress: async (p) => {
          const pct = Math.min(90, Math.max(12, Math.round(12 + p * 78)));
          post(pct, undefined, undefined);
          await tick();
        },
        onStage: (s) => {
          if (s === 'finalize') finalizeCount++;
          post(undefined, STAGE_LABELS[s] || s, `[*] Stage: ${s}`);
        },
      });
      blob = asBlob(res);
      if (blob) route = finalizeCount > 1 ? 'ffmpeg-prepare+patch' : 'patch';
    } catch (err) {
      const msg = (err && err.message) || String(err);
      notes.push('primary patch: ' + msg);
      post(30, 'Primary patch refused the file', `[!] Primary patch failed: ${msg}`);
      await tick();
    }

    // ---- 2) fallback: ffmpeg stream copy (same as original worker; output is NOT patched) -------
    if (!blob) {
      try {
        post(40, 'Switching to stream-copy...', '[*] Trying ffmpeg stream-copy fallback (output will NOT be patched)...');
        await tick();
        const mod = await import('./assets/c-CMiR0szy.js');
        const fn = mod.encodeHybridStep || mod.fpsItsscaleStep || mod.hybridFfmpegCompatibleOptimize;
        if (typeof fn !== 'function') throw new Error('ffmpeg step export not found');
        const res = await fn(makeFile(), {
          onProgress: async (p) => { post(Math.min(90, Math.round(40 + p * 50)), undefined, undefined); await tick(); },
        });
        blob = asBlob(res);
        if (blob) route = 'ffmpeg-stream-copy';
      } catch (err) {
        const msg = (err && err.message) || String(err);
        notes.push('ffmpeg: ' + msg);
        post(50, 'Stream-copy failed', `[!] ffmpeg fallback failed: ${msg}`);
        await tick();
      }
    }

    // ---- 3) last resort: legacy in-memory remux ---------------------------------------------------
    if (!blob) {
      post(60, 'Legacy remux...', '[*] Trying legacy in-memory remux...');
      await tick();
      const eng = await import('./hybridEngine.js');
      const fn = eng.remuxMp4Boxes || eng.default;
      if (typeof fn !== 'function') throw new Error('hybridEngine remux export not found');
      const out = fn(new Uint8Array(buffer), { extendTiming: true });
      if (out && out.length) {
        blob = new Blob([out], { type: 'video/mp4' });
        route = 'legacy-remux';
      }
    }

    if (!blob) throw new Error('All pipelines failed. ' + notes.join(' | '));

    post(95, 'Finalizing...', `[+] Output built via route: ${route} (${blob.size} bytes)`);
    const out = new Uint8Array(await blob.arrayBuffer());
    post(100, 'Done', `[SUCCESS] Route: ${route}`);
    self.postMessage({ type: 'done', buffer: out.buffer, route, notes }, [out.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', error: (err && err.message) || String(err) });
  }
};
