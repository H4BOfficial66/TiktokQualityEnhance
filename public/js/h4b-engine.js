/**
 * H4B Quality Enhancer - Method Engine
 * High-Precision In-Browser Container Restructure & ByteDance Ingestion Bypass Engine
 * 
 * Features:
 * 1. ByteDance / CapCut Desktop ("vicut") hardware profile metadata injection
 * 2. Automatic Video (Stream 0) & Audio (Stream 1) track alignment
 * 3. 64-bit indefinite duration container header (mvhd v1)
 * 4. FastStart container restructuring with exact stco / co64 chunk offset recalculation
 * 5. Complete removal of existing platform watermarks and download tags
 * 6. Zero loss, 100% frame-perfect video bitstream preservation
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    root.h4bRestructureMp4 = exports.h4bRestructureMp4;
    root.remuxMp4Boxes = exports.h4bRestructureMp4;
    root.injectMetadata = exports.injectMetadata;
    root.parseMp4Structure = exports.parseMp4Structure;
    root.Te = exports.h4bRestructureMp4;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function() {
  'use strict';

  // Base64 of official 1,064-byte ByteDance/vicut bypass udta box
  const OFFICIAL_UDTA_B64 = 
    "AAAEKHVkdGEAAAQgbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWR0YQAAAAAAAAAAAAAAAAAAAACAa2V5cwAAAAAAAAAGAAAACm1kdGFIdwAAAA9tZHRhYml0cmF0ZQAAACNtZHRhY29tLmFwcGxlLnF1aWNrdGltZS5hcnR3b3JrAAAAD21kdGFtYXhyYXRlAAAAFm1kdGF0ZV9pc19yZWVuY29kZQAAAA9tZHRhZW5jb2RlcgAAA3NpbHN0AAAAGQAAAAEAAAARZGF0YQAAAAEAAAAAMQAAACAAAAACAAAAGGRhdGEAAAABAAAAADIyMDAwMDAwAAACjQAAAAMAAAKFZGF0YQAAAAEAAAAAeyJkYXRhIjp7ImVkaXRUeXBlIjoiZGVmYXVsdCIsImluZm9TdGlja2VySWQiOiIiLCJpc19haV9seXJpYyI6MCwiaXNfYWltdXNpY19tdiI6MCwiaXNfdXNlX2FpX2ltYWdlX2dlbmVyYXRpb24iOjAsImlzX3VzZV9haV92aWRlb19nZW5lcmF0aW9uIjowLCJpc191c2VfYWltdXNpY19iZ20iOjAsImlzX3VzZV9haW11c2ljX3ZvY2FsIjowLCJpc191c2VfZ3JhcGhfY2hhcnQiOjAsImlzX3VzZV9qaWNodWFuZ19tb2RlX2luX2FpX3dyaXRlciI6MCwiaXNfdXNlX3JlbGlnaHQiOjAsImlzX3VzZV92Y19zaW5nX2Nsb25lIjoxLCJpc191c2Vfdm9pY2VfY2xvbmUiOiIwIiwibW90aW9uX2JsdXJfY250IjowLCJtdXNpY0lkIjoiIiwib3MiOiJ3aW5kb3dzIiwicHJvZHVjdCI6InZpY3V0Iiwic3RpY2tlcklkIjoiIiwidmlkZW9FZmZlY3RJZCI6IiIsInZpZGVvSWQiOiIzNzA3ZDZkOS0xMTNjLTQxYjktOThjZS0zMDFlNDAzNzQxMWEiLCJ2aWRlb1BhcmFtcyI6eyJiZSI6MCwiZWYiOjAsImZ0IjowLCJtYSI6MCwibWUiOjAsIm11IjowLCJyZSI6MCwic3AiOjQsInN0IjowLCJ0ZSI6MCwidHgiOjAsInYiOjAsInZzIjowfX0sInNvdXJjZV9wbGF0Zm9ybSI6ImRlc2t0b3AiLCJzb3VyY2VfdHlwZSI6InZpY3V0In0AAAAZAAAABAAAABFkYXRhAAAAAQAAAAAwAAAAGQAAAAUAAAARZGF0YQAAAAEAAAAAMQAAACQAAAAGAAAAHGRhdGEAAAABAAAAAExhdmY2MS4xLjEwMAAAABipdG9vAAAAEGRhdGEAAAABAAAAAAAAADepY210AAAAL2RhdGEAAAABAAAAAE9wdGltaXplIGJ5IG1ldGhvZC5iaWxsb3hkLnNpdGU=";

  function base64ToUint8Array(base64) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  function stringToBytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function readFourCC(uint8Arr, offset) {
    return String.fromCharCode(
      uint8Arr[offset],
      uint8Arr[offset + 1],
      uint8Arr[offset + 2],
      uint8Arr[offset + 3]
    );
  }

  function h4bRestructureMp4(input, options = {}) {
    let bytes;
    if (input instanceof Uint8Array) {
      bytes = input;
    } else if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
      bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
      throw new Error('Unsupported input buffer type');
    }

    const filename = options.fileName || options.filename || 'video.mp4';
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // 1. Parse top-level atoms
    let pos = 0;
    const boxes = [];
    while (pos < bytes.length) {
      if (pos + 8 > bytes.length) break;
      const size32 = view.getUint32(pos, false);
      const type = readFourCC(bytes, pos + 4);
      let boxSize = size32;
      let headerSize = 8;

      if (size32 === 1) {
        if (pos + 16 > bytes.length) break;
        boxSize = Number(view.getBigUint64(pos + 8, false));
        headerSize = 16;
      } else if (size32 === 0) {
        boxSize = bytes.length - pos;
      }

      boxes.push({
        type,
        start: pos,
        size: boxSize,
        headerSize,
        data: bytes.subarray(pos, pos + boxSize)
      });

      if (boxSize <= 0) break;
      pos += boxSize;
    }

    const ftypBox = boxes.find(b => b.type === 'ftyp');
    const moovBox = boxes.find(b => b.type === 'moov');
    const mdatBoxes = boxes.filter(b => b.type === 'mdat');

    if (!ftypBox || !moovBox || mdatBoxes.length === 0) {
      throw new Error('Invalid MP4 structure: missing essential ftyp, moov, or mdat atoms.');
    }

    // 2. Parse inside moov
    const moovData = moovBox.data;
    const moovView = new DataView(moovData.buffer, moovData.byteOffset, moovData.byteLength);
    let mPos = 8;
    const moovChildren = [];
    while (mPos < moovData.length) {
      if (mPos + 8 > moovData.length) break;
      const size32 = moovView.getUint32(mPos, false);
      const type = readFourCC(moovData, mPos + 4);
      let boxSize = size32;
      if (size32 === 1) {
        boxSize = Number(moovView.getBigUint64(mPos + 8, false));
      } else if (size32 === 0) {
        boxSize = moovData.length - mPos;
      }

      moovChildren.push({
        type,
        start: mPos,
        size: boxSize,
        data: moovData.subarray(mPos, mPos + boxSize)
      });

      if (boxSize <= 0) break;
      mPos += boxSize;
    }

    // 3. Format mvhd to Version 1 (64-bit indefinite duration)
    const mvhdChild = moovChildren.find(c => c.type === 'mvhd');
    if (!mvhdChild) {
      throw new Error('Invalid MP4: missing mvhd header.');
    }

    const rawMvhd = mvhdChild.data;
    const rawMvhdView = new DataView(rawMvhd.buffer, rawMvhd.byteOffset, rawMvhd.byteLength);
    const ver = rawMvhd[8];
    let creationTime = 0n;
    let modTime = 0n;
    let timescale = 1000;

    if (ver === 0) {
      creationTime = BigInt(rawMvhdView.getUint32(12, false));
      modTime = BigInt(rawMvhdView.getUint32(16, false));
      timescale = rawMvhdView.getUint32(20, false);
    } else {
      creationTime = rawMvhdView.getBigUint64(12, false);
      modTime = rawMvhdView.getBigUint64(20, false);
      timescale = rawMvhdView.getUint32(28, false);
    }

    const newMvhd = new Uint8Array(120);
    const newMvhdView = new DataView(newMvhd.buffer);
    newMvhdView.setUint32(0, 120, false);
    newMvhd.set(stringToBytes('mvhd'), 4);
    newMvhd[8] = 1; // version 1 (64-bit)
    newMvhd[9] = 0; newMvhd[10] = 0; newMvhd[11] = 0; // flags
    newMvhdView.setBigUint64(12, creationTime, false);
    newMvhdView.setBigUint64(20, modTime, false);
    newMvhdView.setUint32(28, timescale, false);
    newMvhdView.setBigUint64(32, 0xFFFFFFFFFFFFFFFFn, false); // Indefinite duration bypass

    // Copy matrix, volume, rate, and next_track_id tail
    const mvhdTail = ver === 0 ? rawMvhd.subarray(28) : rawMvhd.subarray(40);
    newMvhd.set(mvhdTail, 40);

    // 4. Identify and order video/audio tracks (Video must be Track 1 / Stream 0)
    const trakChildren = moovChildren.filter(c => c.type === 'trak');
    let videoTrak = null;
    let audioTrak = null;
    const otherTraks = [];

    for (const trak of trakChildren) {
      const tData = trak.data;
      let subtype = '';
      for (let i = 0; i <= tData.length - 16; i++) {
        if (tData[i] === 0x68 && tData[i+1] === 0x64 && tData[i+2] === 0x6c && tData[i+3] === 0x72) { // 'hdlr'
          subtype = readFourCC(tData, i + 12);
          break;
        }
      }
      if (subtype === 'vide' && !videoTrak) {
        videoTrak = trak;
      } else if (subtype === 'soun' && !audioTrak) {
        audioTrak = trak;
      } else {
        otherTraks.push(trak);
      }
    }

    const orderedTraks = [];
    if (videoTrak) orderedTraks.push(videoTrak);
    if (audioTrak) orderedTraks.push(audioTrak);
    for (const ot of otherTraks) orderedTraks.push(ot);

    // Update track IDs in tkhd: Video = 1, Audio = 2
    orderedTraks.forEach((trak, idx) => {
      const trackId = idx + 1;
      const tData = trak.data;
      const tView = new DataView(tData.buffer, tData.byteOffset, tData.byteLength);
      for (let i = 0; i <= tData.length - 24; i++) {
        if (tData[i] === 0x74 && tData[i+1] === 0x6b && tData[i+2] === 0x68 && tData[i+3] === 0x64) { // 'tkhd'
          const tkhdVer = tData[i + 4];
          const idOffset = i + 4 + (tkhdVer === 1 ? 20 : 12);
          if (idOffset + 4 <= tData.length) {
            tView.setUint32(idOffset, trackId, false);
          }
          break;
        }
      }
    });

    // 5. Official ByteDance / CapCut Desktop Ingestion Bypass Metadata (udta)
    const newUdta = base64ToUint8Array(OFFICIAL_UDTA_B64);

    // Filter out old udta to erase recycled TikTok watermarks and old IDs
    const remainingMoovChildren = moovChildren.filter(c => c.type !== 'mvhd' && c.type !== 'trak' && c.type !== 'udta');

    // Reconstruct moov container
    const newMoovParts = [newMvhd];
    for (const trak of orderedTraks) newMoovParts.push(trak.data);
    for (const other of remainingMoovChildren) newMoovParts.push(other.data);
    newMoovParts.push(newUdta);

    let moovTotalSize = 8;
    for (const p of newMoovParts) moovTotalSize += p.length;

    const newMoov = new Uint8Array(moovTotalSize);
    const newMoovView = new DataView(newMoov.buffer);
    newMoovView.setUint32(0, moovTotalSize, false);
    newMoov.set(stringToBytes('moov'), 4);
    let curOffset = 8;
    for (const p of newMoovParts) {
      newMoov.set(p, curOffset);
      curOffset += p.length;
    }

    // 6. FastStart Container Offset Adjustment
    const newFtyp = ftypBox.data;
    const newPad = new Uint8Array([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65]); // 8-byte free box
    const newMoovOffset = newFtyp.length + newPad.length;
    const newMdatOffset = newMoovOffset + newMoov.length;
    const origMdatOffset = mdatBoxes[0].start;
    const delta = newMdatOffset - origMdatOffset;

    // Adjust stco (32-bit) and co64 (64-bit) chunk offsets in newMoov
    for (let i = 0; i <= newMoov.length - 8; i++) {
      if (newMoov[i] === 0x73 && newMoov[i+1] === 0x74 && newMoov[i+2] === 0x63 && newMoov[i+3] === 0x6f) { // 'stco'
        const count = newMoovView.getUint32(i + 8, false);
        for (let j = 0; j < count; j++) {
          const entryOff = i + 12 + j * 4;
          if (entryOff + 4 <= newMoov.length) {
            const oldOff = newMoovView.getUint32(entryOff, false);
            newMoovView.setUint32(entryOff, oldOff + delta, false);
          }
        }
      } else if (newMoov[i] === 0x63 && newMoov[i+1] === 0x6f && newMoov[i+2] === 0x36 && newMoov[i+3] === 0x34) { // 'co64'
        const count = newMoovView.getUint32(i + 8, false);
        for (let j = 0; j < count; j++) {
          const entryOff = i + 12 + j * 8;
          if (entryOff + 8 <= newMoov.length) {
            const oldOff = newMoovView.getBigUint64(entryOff, false);
            newMoovView.setBigUint64(entryOff, oldOff + BigInt(delta), false);
          }
        }
      }
    }

    // 7. Trailer Box (ZILEM / H4B Optimized Free Atom)
    const trailerText = `ZILEM_OPTIMIZED/1 ${new Date().toISOString()} ${filename}`;
    const trailerTextBytes = stringToBytes(trailerText);
    const trailerBox = new Uint8Array(8 + trailerTextBytes.length);
    const trailerView = new DataView(trailerBox.buffer);
    trailerView.setUint32(0, trailerBox.length, false);
    trailerBox.set(stringToBytes('free'), 4);
    trailerBox.set(trailerTextBytes, 8);

    // 8. Assemble Output Buffer
    let totalMdatLen = 0;
    for (const mdat of mdatBoxes) totalMdatLen += mdat.data.length;

    const totalLen = newFtyp.length + newPad.length + newMoov.length + totalMdatLen + trailerBox.length;
    const finalBuffer = new Uint8Array(totalLen);

    let writePos = 0;
    finalBuffer.set(newFtyp, writePos); writePos += newFtyp.length;
    finalBuffer.set(newPad, writePos); writePos += newPad.length;
    finalBuffer.set(newMoov, writePos); writePos += newMoov.length;
    for (const mdat of mdatBoxes) {
      finalBuffer.set(mdat.data, writePos);
      writePos += mdat.data.length;
    }
    finalBuffer.set(trailerBox, writePos);

    return finalBuffer;
  }

  return {
    h4bRestructureMp4,
    remuxMp4Boxes: h4bRestructureMp4,
    injectMetadata: h4bRestructureMp4,
    parseMp4Structure: () => ({}),
    Te: h4bRestructureMp4
  };
});
