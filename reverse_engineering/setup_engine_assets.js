const fs = require('fs');
const path = require('path');

const engineV2Dir = path.join('public', 'engine', 'v2');
const assetsDir = path.join('public', 'engine', 'v2', 'assets');

if (!fs.existsSync(engineV2Dir)) fs.mkdirSync(engineV2Dir, { recursive: true });
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Move/copy root engine files
['v2Worker.js', 'hybridEngine.js'].forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(engineV2Dir, file));
    console.log('Copied to', engineV2Dir, file);
  }
});

// Move/copy asset engine files
[
  'c-CvVvisn3.js',
  'c-0cqSeuF1.js',
  'c-zr-35zEx.js',
  'c-CMiR0szy.js',
  'c-PLxfNuI9.js',
  'vendor-vision.js',
  'rolldown-runtime.js'
].forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(assetsDir, file));
    console.log('Copied to', assetsDir, file);
  }
});

console.log('Engine directory setup complete!');
