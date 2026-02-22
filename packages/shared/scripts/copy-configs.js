const fs = require('fs');

fs.rmSync('dist/config', { recursive: true, force: true });
fs.cpSync('src/config', 'dist/config', { recursive: true });
