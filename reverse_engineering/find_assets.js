const fs = require('fs');
const c = fs.readFileSync('c-CvVvisn3.js', 'utf8');

const wasmMatches = [...c.matchAll(/["'`]([^\s"'`]+\.wasm)["'`]/gi)].map(m => m[1]);
console.log('Wasm matches:', wasmMatches);

const assetMatches = [...c.matchAll(/["'`]([^\s"'`]+\.(?:js|wasm|worker))["'`]/gi)].map(m => m[1]);
console.log('Asset matches:', Array.from(new Set(assetMatches)));

// Search for fetch / WebAssembly.instantiateStreaming
const wasmInst = [...c.matchAll(/WebAssembly\s*\.\s*([a-zA-Z]+)/g)].map(m => m[1]);
console.log('WebAssembly API calls:', Array.from(new Set(wasmInst)));
