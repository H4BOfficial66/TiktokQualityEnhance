const fs = require('fs');
const c = fs.readFileSync('c-0cqSeuF1.js', 'utf8');
console.log('c-0cqSeuF1.js length:', c.length);

const imports = [...c.matchAll(/import\s*\(\s*["'`]([^\s"'`]+)["'`]\s*\)/g)].map(m => m[1]);
console.log('Dynamic imports in c-0cqSeuF1.js:', Array.from(new Set(imports)));

const strings = [...c.matchAll(/["'`]((\.\/|\/engine\/)[^"'`\s]+)["'`]/g)].map(m => m[1]);
console.log('Path strings in c-0cqSeuF1.js:', Array.from(new Set(strings)));
