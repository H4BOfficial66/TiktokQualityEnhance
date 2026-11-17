const fs = require('fs');

function checkFile(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, 'utf8');
  console.log('=== ' + filename + ' ===');
  const scripts = [...content.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  console.log('Scripts:', scripts);
  const css = [...content.matchAll(/href="([^"]+\.css[^"]*)"/g)].map(m => m[1]);
  console.log('CSS:', css);
}

['index_source.html', 'method_source.html', 'old_method.html', 'stats.html', 'tutorial.html', 'contact.html'].forEach(checkFile);
