/**
 * h4bPatchV3 - container patch reconstructed from the OUTPUT of the live method.billoxd.site engine (v3.0.0 Pro).
 *
 * Input : an MP4 that was already normalized by ffmpeg (-c:v copy, AAC-LC 48k stereo, +faststart),
 *         i.e. layout  ftyp | moov | [free] | mdat
 * Output: ftyp | free(old moov, in place) | [free] | mdat | mdat(ghost audio) | moov(new)
 *
 * What it does (all observed in a real output file):
 *  1. old moov becomes a "free" box in place -> no chunk offset of the real media moves
 *  2. 17 silent AAC frames are appended in a second small mdat (two chunks: 9 + 8 samples)
 *  3. audio track timing is extended: stts (+17x1024), mdhd, elst last segment, tkhd, sbgp 'roll'
 *  4. audio track gets a 2nd sample description (AAC-LC with chan-config 0 + PCE) used by the last ghost chunk
 *  5. the audio track is cloned as an extra audio track (id 3) sharing the same data
 *  6. mvhd duration = longest track, next_track_id fixed
 *  7. udta/meta/ilst gets (c)ART, (c)wrt, keeps (c)too, adds (c)cmt
 *  8. new moov is written at the END of the file
 *
 * The video bitstream is never touched.
 */

export const META = {
  artist: 'method.billoxd.site',
  composer: 'method.billoxd.site',
  comment: 'Optimize by method.billoxd.site',
};
const GHOST_FRAMES = 17;                                   // observed in real output
const SILENT_AAC_STEREO = [0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c]; // standard AAC-LC stereo silent frame (6 bytes)
const AAC_FRAME = 1024;
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts']);

// ---------------------------------------------------------------- byte helpers
const enc = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const cat = (...a) => {
  const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let p = 0;
  for (const x of a) { o.set(x, p); p += x.length; }
  return o;
};
const dv = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u32 = (b, o) => dv(b).getUint32(o);
const w32 = (b, o, v) => dv(b).setUint32(o, v >>> 0);
const be32 = (v) => { const o = new Uint8Array(4); w32(o, 0, v); return o; };
const typeAt = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const box = (type, payload) => cat(be32(payload.length + 8), enc(type), payload);
class PatchError extends Error { constructor(m) { super(m); this.name = 'PatchError'; } }

// ---------------------------------------------------------------- box tree
function readBoxes(buf, start = 0, end = buf.length) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32(buf, p), hdr = 8;
    const type = typeAt(buf, p + 4);
    if (size === 1) { size = Number(dv(buf).getBigUint64(p + 8)); hdr = 16; }
    else if (size === 0) size = end - p;
    if (size < hdr || p + size > end) throw new PatchError(`Invalid box '${type}' at ${p}`);
    out.push({ type, off: p, size, hdr });
    p += size;
  }
  return out;
}
function parseNode(type, payload) {
  if (!CONTAINERS.has(type)) return { type, data: payload, children: null };
  return { type, data: null, children: readBoxes(payload).map((b) => parseNode(b.type, payload.subarray(b.off + b.hdr, b.off + b.size))) };
}
const ser = (n) => (n.children ? box(n.type, cat(...n.children.map(ser))) : box(n.type, n.data));
const child = (n, t) => n.children.find((c) => c.type === t);
const childAt = (n, path) => path.reduce((x, t) => (x ? child(x, t) : null), n);
const cloneNode = (n) => (n.children ? { type: n.type, data: null, children: n.children.map(cloneNode) } : { type: n.type, data: n.data.slice(), children: null });

// ---------------------------------------------------------------- field helpers
function trackKind(trak) {
  const h = childAt(trak, ['mdia', 'hdlr']);
  return h ? typeAt(h.data, 8) : '';
}
const tkhdLayout = (d) => (d[0] === 1 ? { id: 20, dur: 28, big: true } : { id: 12, dur: 20, big: false });
const mdhdLayout = (d) => (d[0] === 1 ? { ts: 20, dur: 24, big: true } : { ts: 12, dur: 16, big: false });
const mvhdLayout = (d) => (d[0] === 1 ? { ts: 20, dur: 24, nid: 108, big: true } : { ts: 12, dur: 16, nid: 96, big: false });
function getDur(d, L) { return L.big ? Number(dv(d).getBigUint64(L.dur)) : u32(d, L.dur); }
function setDur(d, L, v) { if (L.big) dv(d).setBigUint64(L.dur, BigInt(v)); else w32(d, L.dur, v); }

function readElst(d) {
  const v = d[0], n = u32(d, 4), e = [];
  for (let i = 0; i < n; i++) {
    if (v === 1) { const o = 8 + i * 20; e.push({ dur: Number(dv(d).getBigUint64(o)), mt: Number(dv(d).getBigInt64(o + 8)), rate: u32(d, o + 16) }); }
    else { const o = 8 + i * 12; e.push({ dur: u32(d, o), mt: dv(d).getInt32(o + 4), rate: u32(d, o + 8) }); }
  }
  return { v, e };
}
function writeElst({ v, e }) {
  const o = new Uint8Array(8 + e.length * (v === 1 ? 20 : 12));
  o[0] = v; w32(o, 4, e.length);
  e.forEach((x, i) => {
    if (v === 1) { const p = 8 + i * 20; dv(o).setBigUint64(p, BigInt(x.dur)); dv(o).setBigInt64(p + 8, BigInt(x.mt)); w32(o, p + 16, x.rate); }
    else { const p = 8 + i * 12; w32(o, p, x.dur); dv(o).setInt32(p + 4, x.mt); w32(o, p + 8, x.rate); }
  });
  return o;
}

// ---------------------------------------------------------------- esds / 2nd sample description
function readLen(b, o) { let len = 0, i = 0; for (; i < 4; i++) { const c = b[o + i]; len = (len << 7) | (c & 0x7f); if (!(c & 0x80)) { i++; break; } } return { len, n: i }; }
const fixedLen = (len) => Uint8Array.from([0x80 | ((len >> 21) & 0x7f), 0x80 | ((len >> 14) & 0x7f), 0x80 | ((len >> 7) & 0x7f), len & 0x7f]);

/** Build a copy of an mp4a sample entry whose AudioSpecificConfig is: AAC-LC, chan-config 0 + explicit PCE (observed). */
function buildAltAudioEntry(entry) {
  // entry = full mp4a box. Find 'esds' inside (after 8+28 audio sample entry header).
  const body = entry.subarray(8);
  const esdsPos = [...Array(body.length - 4).keys()].find((i) => typeAt(body, i) === 'esds');
  if (esdsPos === undefined) throw new PatchError('esds not found in audio sample entry');
  const esdsStart = esdsPos - 4;                          // box start inside body
  const esdsSize = u32(body, esdsStart);
  const esdsPayload = body.subarray(esdsStart + 8, esdsStart + esdsSize); // ver/flags + descriptors
  let p = 4;                                              // after ver/flags
  if (esdsPayload[p] !== 0x03) throw new PatchError('unexpected esds layout');
  const es = readLen(esdsPayload, p + 1); const esBody = p + 1 + es.n;
  const esHead = esdsPayload.subarray(esBody, esBody + 3); // ES_ID(2) + flags(1)
  let q = esBody + 3;
  if (esdsPayload[q] !== 0x04) throw new PatchError('unexpected DecoderConfig layout');
  const dc = readLen(esdsPayload, q + 1); const dcBody = q + 1 + dc.n;
  const dcFixed = esdsPayload.subarray(dcBody, dcBody + 13); // objType, streamType, bufferSize, maxBr, avgBr
  let r = dcBody + 13;
  if (esdsPayload[r] !== 0x05) throw new PatchError('unexpected DecoderSpecificInfo layout');
  const ds = readLen(esdsPayload, r + 1); const dsBody = r + 1 + ds.n;
  const asc = esdsPayload.subarray(dsBody, dsBody + ds.len);
  const tail = esdsPayload.subarray(dsBody + ds.len);       // SLConfig descriptor etc.
  // original ASC: 2 bytes = objType(5) freqIdx(4) chanCfg(4) ...; new: same first 8 bits+freq, chanCfg=0, then PCE
  const objType = asc[0] >> 3, freqIdx = ((asc[0] & 7) << 1) | (asc[1] >> 7);
  if (objType !== 2 || freqIdx !== 3) throw new PatchError('alt sample entry only supported for AAC-LC 48 kHz');
  const newAsc = Uint8Array.from([0x11, 0x80, 0x04, 0xc0, 0x40, 0x00, 0x20, 0x00]);
  const dsNew = cat(Uint8Array.of(0x05), fixedLen(newAsc.length), newAsc);
  const dcInner = cat(dcFixed, dsNew, tail.length ? new Uint8Array(0) : new Uint8Array(0));
  // DecoderConfig covers: fixed(13) + DSI; SLConfig (tail) is a sibling inside ES descriptor
  const dcNew = cat(Uint8Array.of(0x04), fixedLen(dcInner.length), dcInner);
  const esInner = cat(esHead, dcNew, tail);
  const esNew = cat(Uint8Array.of(0x03), fixedLen(esInner.length), esInner);
  const newEsds = box('esds', cat(esdsPayload.subarray(0, 4), esNew));
  const newBody = cat(body.subarray(0, esdsStart), newEsds, body.subarray(esdsStart + esdsSize));
  return box('mp4a', newBody);
}

// ---------------------------------------------------------------- udta
function patchUdta(udtaNode, meta) {
  const items = [];
  let ilstHdlr = box('hdlr', cat(be32(0), be32(0), enc('mdir'), enc('appl'), new Uint8Array(9)));
  if (udtaNode) {
    const metaB = readBoxes(udtaNode.data).find((b) => b.type === 'meta');
    if (metaB) {
      const mp = udtaNode.data.subarray(metaB.off + metaB.hdr + 4, metaB.off + metaB.size); // skip ver/flags
      for (const b of readBoxes(mp)) {
        if (b.type === 'hdlr') ilstHdlr = mp.slice(b.off, b.off + b.size);
        if (b.type === 'ilst') for (const it of readBoxes(mp.subarray(b.off + b.hdr, b.off + b.size))) {
          const raw = mp.subarray(b.off + b.hdr + it.off, b.off + b.hdr + it.off + it.size);
          items.push({ name: it.type, raw: raw.slice() });
        }
      }
    }
  }
  const textItem = (name, text) => box(name, box('data', cat(be32(1), be32(0), new TextEncoder().encode(text))));
  const keep = items.filter((i) => !['\u00a9ART', '\u00a9wrt', '\u00a9cmt'].includes(i.name)).map((i) => i.raw);
  const ilst = box('ilst', cat(
    textItem('\u00a9ART', meta.artist), textItem('\u00a9wrt', meta.composer), ...keep, textItem('\u00a9cmt', meta.comment),
  ));
  // item names contain 0xA9: box() encodes via charCodeAt (0xA9 fits one byte) - good
  return { type: 'udta', data: box('meta', cat(be32(0), ilstHdlr, ilst)), children: null };
}

// ---------------------------------------------------------------- main
export function patchV3(input, opts = {}) {
  const meta = { ...META, ...(opts.meta || {}) };
  const ghostN = opts.ghostFrames ?? GHOST_FRAMES;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const top = readBoxes(bytes);
  const moovs = top.filter((b) => b.type === 'moov'), mdats = top.filter((b) => b.type === 'mdat');
  if (moovs.length !== 1 || !mdats.length) throw new PatchError('Expected exactly one moov and at least one mdat.');
  if (top.some((b) => ['moof', 'mfra', 'sidx'].includes(b.type))) throw new PatchError('Fragmented MP4 is not supported.');
  if (moovs[0].hdr !== 8) throw new PatchError('64-bit moov header not supported.');
  if (moovs[0].off > mdats[0].off) throw new PatchError('Input must be fast-start (moov before mdat). Normalize with ffmpeg first.');

  const moov = parseNode('moov', bytes.subarray(moovs[0].off + 8, moovs[0].off + moovs[0].size));
  const traks = moov.children.filter((c) => c.type === 'trak');
  const aIdx = traks.findIndex((t) => trackKind(t) === 'soun');
  if (aIdx < 0) throw new PatchError('No audio track found (the v3 patch needs audio).');
  const audio = traks[aIdx];
  const stbl = childAt(audio, ['mdia', 'minf', 'stbl']);
  const stsd = child(stbl, 'stsd'), stts = child(stbl, 'stts'), stsc = child(stbl, 'stsc'), stsz = child(stbl, 'stsz'), stco = child(stbl, 'stco');
  if (!stsd || !stts || !stsc || !stsz || !stco) throw new PatchError('Audio track needs stsd/stts/stsc/stsz/stco (co64 not supported).');
  if (u32(stsd.data, 4) !== 1 || typeAt(stsd.data, 12) !== 'mp4a') throw new PatchError('Audio must be a single mp4a (AAC) description.');

  // --- ghost payload (mdat #2) ---
  const c1 = Math.ceil(ghostN / 2), c2 = ghostN - c1, S = SILENT_AAC_STEREO.length;
  const ghostPayload = new Uint8Array(ghostN * S);
  for (let i = 0; i < ghostN; i++) ghostPayload.set(SILENT_AAC_STEREO, i * S);
  const ghostMdat = box('mdat', ghostPayload);
  const ghostOff = bytes.length + 8;
  if (ghostOff + ghostPayload.length > 0xffffffff) throw new PatchError('File too large for 32-bit chunk offsets.');

  // --- stsz ---
  if (u32(stsz.data, 4) !== 0) throw new PatchError('Constant-size audio samples are not supported.');
  const nSamples = u32(stsz.data, 8);
  { const o = new Uint8Array(12 + (nSamples + ghostN) * 4); o.set(stsz.data.subarray(0, 12)); w32(o, 8, nSamples + ghostN);
    o.set(stsz.data.subarray(12, 12 + nSamples * 4), 12);
    for (let i = 0; i < ghostN; i++) w32(o, 12 + (nSamples + i) * 4, S);
    stsz.data = o; }
  // --- stts ---
  { const n = u32(stts.data, 4); const last = n ? [u32(stts.data, 8 + (n - 1) * 8), u32(stts.data, 12 + (n - 1) * 8)] : null;
    if (last && last[1] === AAC_FRAME) { const o = stts.data.slice(); w32(o, 8 + (n - 1) * 8, last[0] + ghostN); stts.data = o; }
    else stts.data = cat(stts.data.subarray(0, 4), be32(n + 1), stts.data.subarray(8), be32(ghostN), be32(AAC_FRAME)); }
  // --- stco / stsc ---
  const nChunks = u32(stco.data, 4);
  stco.data = cat(stco.data.subarray(0, 4), be32(nChunks + 2), stco.data.subarray(8), be32(ghostOff), be32(ghostOff + c1 * S));
  const nsc = u32(stsc.data, 4);
  const stscBase = cat(stsc.data.subarray(0, 4), be32(nsc + 2), stsc.data.subarray(8));
  stsc.data = cat(stscBase, be32(nChunks + 1), be32(c1), be32(1), be32(nChunks + 2), be32(c2), be32(1));
  // --- sbgp 'roll' ---
  for (const sb of stbl.children.filter((c) => c.type === 'sbgp')) {
    const d = sb.data; if (typeAt(d, 4) !== 'roll' || d[0] !== 0) continue;
    const n = u32(d, 8); let sum = 0; for (let i = 0; i < n; i++) sum += u32(d, 12 + i * 8);
    if (sum !== nSamples) continue;
    sb.data = cat(d.subarray(0, 8), be32(n + 1), d.subarray(12), be32(ghostN), be32(0));
  }
  // --- timing: mdhd / elst / tkhd ---
  const mdhd = childAt(audio, ['mdia', 'mdhd']), ML = mdhdLayout(mdhd.data);
  const mediaTs = u32(mdhd.data, ML.ts);
  const mvhd = child(moov, 'mvhd'); const MV = mvhdLayout(mvhd.data); const movieTs = u32(mvhd.data, MV.ts);
  { const d = mdhd.data.slice(); setDur(d, ML, getDur(d, ML) + ghostN * AAC_FRAME); mdhd.data = d; }
  const ghostMovie = Math.round((ghostN * AAC_FRAME) / mediaTs * movieTs);
  const edts = child(audio, 'edts'); const elstN = edts && child(edts, 'elst');
  if (elstN) { const el = readElst(elstN.data); if (el.e.length) { el.e[el.e.length - 1].dur += ghostMovie; elstN.data = writeElst(el); } }
  const tkhd = child(audio, 'tkhd'), TL = tkhdLayout(tkhd.data);
  { const d = tkhd.data.slice(); setDur(d, TL, getDur(d, TL) + ghostMovie); tkhd.data = d; }

  // --- clone audio track (id 3) BEFORE adding the alternate sample description ---
  const dup = cloneNode(audio);
  const maxId = Math.max(...traks.map((t) => u32(child(t, 'tkhd').data, tkhdLayout(child(t, 'tkhd').data).id)));
  { const dt = child(dup, 'tkhd'); const d = dt.data.slice(); w32(d, tkhdLayout(d).id, maxId + 1); dt.data = d; }
  // --- audio track 2: second sample description used by the last ghost chunk ---
  { const entry1 = stsd.data.subarray(8, 8 + u32(stsd.data, 8));
    const alt = buildAltAudioEntry(entry1);
    stsd.data = cat(stsd.data.subarray(0, 4), be32(2), stsd.data.subarray(8), alt);
    const d = stsc.data.slice(); w32(d, d.length - 4, 2); stsc.data = d; }   // last chunk -> description #2

  // --- assemble new moov ---
  const newTraks = [...traks]; newTraks.splice(aIdx + 1, 0, dup);
  const allDurs = newTraks.map((t) => getDur(child(t, 'tkhd').data, tkhdLayout(child(t, 'tkhd').data)));
  { const d = mvhd.data.slice(); setDur(d, MV, Math.max(...allDurs)); w32(d, MV.nid, maxId + 2); mvhd.data = d; }
  const udtaOld = child(moov, 'udta');
  const udtaNew = patchUdta(udtaOld, meta);
  const kids = [mvhd, ...newTraks, ...moov.children.filter((c) => !['mvhd', 'trak', 'udta'].includes(c.type)), udtaNew];
  const newMoov = ser({ type: 'moov', data: null, children: kids });

  // --- final file: old moov -> free (in place), ghost mdat, new moov ---
  const out = new Uint8Array(bytes.length + ghostMdat.length + newMoov.length);
  out.set(bytes, 0);
  out.set(enc('free'), moovs[0].off + 4);
  out.set(ghostMdat, bytes.length);
  out.set(newMoov, bytes.length + ghostMdat.length);
  return out;
}

export default patchV3;
