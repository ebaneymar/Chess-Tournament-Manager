const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'app', 'assets', 'logo.svg');
const output = path.join(root, 'app', 'assets', 'logo.png');

sharp(input)
  .resize(512, 512)
  .png()
  .toFile(output)
  .then(() => console.log('Generated app/assets/logo.png'))
  .catch(err => { console.error(err); process.exit(1); });
