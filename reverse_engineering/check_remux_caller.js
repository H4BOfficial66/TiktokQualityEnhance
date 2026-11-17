const fs = require('fs');
const c = fs.readFileSync('chunk_493.js', 'utf8');

// Find where remuxMp4Boxes is called
const idx = c.indexOf('remuxMp4Boxes');
console.log('--- Calling snippet around remuxMp4Boxes ---');
console.log(c.substring(Math.max(0, idx - 400), Math.min(c.length, idx + 800)));
