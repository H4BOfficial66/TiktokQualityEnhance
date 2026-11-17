# Fix notes: 540p vs 1080p (method.billoxd.site /method)

## Root cause (found by reverse engineering)
1. `public/js/method-app.js` defined `runV2Worker()` but NEVER called it. The /method page ran only the
   simplified `h4bRestructureMp4()` (a guess), and the progress/log lines were canned text with fake delays.
2. `public/engine/v2/hybridEngine.js` was overwritten with that same simplified guess instead of the real module.
3. The real V2 engine (`assets/c-CvVvisn3.js` -> `patchServerHybrid`) needs ffmpeg.wasm at
   `/ffmpeg-esm/*` and `/ffmpeg-core/*` for its prepare/fallback steps. These were missing from the clone.

## Output differences (same input, real engine vs old clone engine), measured
| item                 | real V2 (phone)                        | old clone                               |
|----------------------|----------------------------------------|-----------------------------------------|
| moov position        | kept as in source                      | forced faststart (moov before mdat)     |
| udta / metadata      | source udta kept, adds (c)cmt + empty (c)too | udta replaced by fake CapCut "vicut" blob |
| other top boxes      | kept                                   | everything except ftyp/moov/mdat dropped|
| track ids            | untouched                              | renumbered                              |
| tail free box        | fixed ZILEM_OPTIMIZED marker           | marker with current time + filename     |
| mvhd                 | v1, duration 0xFF..FF                  | same                                    |

## What changed
- NEW `public/engine/v2/h4bWorker.js`: runs the real engine, same fallback order, logs the real route.
- `public/engine/v2/hybridEngine.js`: restored to the real module (from reverse_engineering/).
- `public/js/method-app.js`: /method now uses the worker; /old-method behaviour unchanged.
- `server.js` + `package.json`: serve `@ffmpeg/ffmpeg` and `@ffmpeg/core` at `/ffmpeg-esm` and `/ffmpeg-core`.

## Run
    npm install && npm start      # http://localhost:3000/method

After processing, the terminal shows `Engine route:`.
 - `patch` or `ffmpeg-prepare+patch`  -> real patched output
 - `ffmpeg-stream-copy` / `legacy-remux` -> the patch refused your file (reason is in the log).
   NOTE: the real engine rejects any file that already has an encoder tag (c-too, e.g. "Lavf" from CapCut/ffmpeg exports).


---
# Update 2: the LIVE site engine is different from the archive snapshot (v3)

Comparing real outputs (same source video):
| | live site (1080p on TikTok) | previous clone (540p) |
|---|---|---|
| video bitstream | untouched (identical md5) | untouched |
| audio | re-encoded AAC-LC 48 kHz stereo 192k | original (HE-AACv2 44.1k 64k) |
| audio tracks | 2 (duplicate, sharing same data) | 1 |
| audio length | +17 silent AAC frames (~0.36 s longer than video) in 2nd small mdat | none |
| old moov | turned into `free` in place | kept (faststart) |
| new moov | at END of file | front |
| mvhd | v0, normal duration | v1, duration 0xFF..FF |
| tail marker | none | ZILEM_OPTIMIZED free box |

New: `public/engine/v2/h4bPatchV3.js` reproduces this. The worker runs it first (route `v3`):
ffmpeg.wasm (`-c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 +faststart`) then `patchV3()`.
Verified on the sample: decodes cleanly, video bit-identical, 2 audio streams, tables match the live output pattern.

Assumptions (single sample): ghost frame count = 17 (constant `GHOST_FRAMES`), metadata strings in `META`.
If TikTok still shows 540p, send a second source with a different length + the live site's output for it.
`tools/mp4dump.py file.mp4` and `tools/mp4tables.py file.mp4` print box trees/tables for diffing.
