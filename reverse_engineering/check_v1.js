const fs = require('fs');
const c = fs.readFileSync('chunk_493.js', 'utf8');

const idx = c.indexOf('remuxMp4Boxes');
console.log('--- Before remuxMp4Boxes ---');
console.log(c.substring(Math.max(0, idx - 1200), idx));
