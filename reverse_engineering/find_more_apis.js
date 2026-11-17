const fs = require('fs');

['stats.html', 'contact.html', 'tutorial.html', 'old_method.html'].forEach(filename => {
  const content = fs.readFileSync(filename, 'utf8');
  console.log('=== ' + filename + ' ===');
  const matches = [...content.matchAll(/["'](\/api\/[^"']+)["']/g)].map(m => m[1]);
  console.log('API matches:', matches);
});
