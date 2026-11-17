const fs = require('fs');

global.self = { webpackChunk_N_E: [] };
global.window = global;
require('./chunk_235.js');
const entry = global.self.webpackChunk_N_E[0];
const modules = entry[1];
const dummyModule = { exports: {} };
const dummyRequire = (id) => console.log('Require:', id);
dummyRequire.r = (exports) => { Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' }); };
dummyRequire.d = (exports, definition) => {
  for (const key in definition) {
    if (Object.prototype.hasOwnProperty.call(definition, key)) {
      Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
    }
  }
};
modules['9235'](dummyModule, dummyModule.exports, dummyRequire);
console.log('9235 default:', dummyModule.exports.default ? dummyModule.exports.default.toString().substring(0, 300) : null);
console.log('9235 create:', dummyModule.exports.create ? dummyModule.exports.create.toString().substring(0, 300) : null);
