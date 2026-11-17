const fs = require('fs');

const files = [
  'v2Worker.js',
  'hybridEngine.js',
  'c-CvVvisn3.js',
  'c-zr-35zEx.js',
  'c-CMiR0szy.js',
  'c-PLxfNuI9.js',
  'vendor-vision.js'
];

const foundUrls = new Set();

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf8');
  // Match any relative or absolute paths or imports
  const matches = [...content.matchAll(/["'`]((\.\/|\/engine\/)[^"'`\s\)]+)["'`]/g)].map(m => m[1]);
  matches.forEach(m => foundUrls.add(m));
  const importMatches = [...content.matchAll(/import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map(m => m[1]);
  importMatches.forEach(m => foundUrls.add(m));
});

console.log('All referenced paths in engine files:');
console.log(Array.from(foundUrls));
