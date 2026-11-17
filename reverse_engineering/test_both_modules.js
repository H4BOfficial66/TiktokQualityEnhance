const fs = require('fs');

function loadModule(filePath, moduleId) {
  global.self = { webpackChunk_N_E: [] };
  global.window = global;
  require(filePath);
  const entry = global.self.webpackChunk_N_E[0];
  const modules = entry[1];
  const dummyModule = { exports: {} };
  const dummyRequire = (id) => {
    console.log('Require called for:', id);
  };
  dummyRequire.r = (exports) => { Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' }); };
  dummyRequire.d = (exports, definition) => {
    for (const key in definition) {
      if (Object.prototype.hasOwnProperty.call(definition, key) && !Object.prototype.hasOwnProperty.call(exports, key)) {
        Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
      }
    }
  };
  modules[moduleId](dummyModule, dummyModule.exports, dummyRequire);
  return dummyModule.exports;
}

const mod91 = loadModule('./chunk_91.js', '4091');
console.log('Chunk 91 exports:', Object.keys(mod91));

const mod969 = loadModule('./chunk_969.js', '9969');
console.log('Chunk 969 exports:', Object.keys(mod969));
console.log('typeof transformVideo:', typeof mod969.transformVideo);
console.log('typeof remuxMp4Boxes:', typeof mod91.remuxMp4Boxes);
console.log('typeof injectMetadata:', typeof mod91.injectMetadata);
