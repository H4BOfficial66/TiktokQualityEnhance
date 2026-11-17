const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.js') || f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const apiMatches = [...content.matchAll(/["'`](\/api\/[^"'`]+)["'`]/g)].map(m => m[1]);
  if (apiMatches.length > 0) {
    console.log(f, 'API routes:', Array.from(new Set(apiMatches)));
  }
  const fetchMatches = [...content.matchAll(/fetch\s*\(\s*["'`]?([^"')]+)["'`]?/g)].map(m => m[1]);
  if (fetchMatches.length > 0) {
    console.log(f, 'fetch calls:', Array.from(new Set(fetchMatches)).filter(x => !x.includes('http://www.w3.org')));
  }
});
