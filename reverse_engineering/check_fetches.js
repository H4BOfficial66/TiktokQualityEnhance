const fs = require('fs');

// Decode chunk_493 fetch calls
const c493 = fs.readFileSync('chunk_493.js', 'utf8');

// Find all fetch( calls in c493
const fetchIndices = [...c493.matchAll(/fetch\(/g)].map(m => m.index);
console.log('Fetch indices in chunk_493:', fetchIndices);
fetchIndices.forEach(idx => {
  console.log('--- fetch snippet ---');
  console.log(c493.substring(Math.max(0, idx - 100), Math.min(c493.length, idx + 300)));
});
