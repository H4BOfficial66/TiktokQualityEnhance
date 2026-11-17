const fs = require('fs');
const path = require('path');

// Ensure directories exist
['public', 'public/css', 'public/js', 'public/assets', 'data'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Copy assets
['logo.png', 'favicon.ico', 'enahncerlogo.png'].forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('public/assets', file));
    fs.copyFileSync(file, path.join('public', file));
  }
});

// Combine CSS
const css1 = fs.readFileSync('css1.css', 'utf8');
const css2 = fs.readFileSync('css2.css', 'utf8');
// Clean up any Next.js artifact comments
fs.writeFileSync('public/css/styles.css', css1 + '\n\n' + css2);

// Move engine
fs.copyFileSync('bxd-engine-test.js', 'public/js/bxd-engine.js');

// Create initial counter
if (!fs.existsSync('data/counter.json')) {
  fs.writeFileSync('data/counter.json', JSON.stringify({ count: 25666 }, null, 2));
}

console.log('Directories, assets, CSS, and engine setup completed successfully!');
