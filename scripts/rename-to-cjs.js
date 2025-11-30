import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distMainPath = path.join(__dirname, '..', 'dist', 'main');

function renameJsToCjs(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      renameJsToCjs(fullPath);
    } else if (item.name.endsWith('.js')) {
      const newPath = fullPath.replace(/\.js$/, '.cjs');
      fs.renameSync(fullPath, newPath);
      console.log(`Renamed: ${item.name} -> ${item.name.replace('.js', '.cjs')}`);
    }
  }
}

console.log('Renaming .js files to .cjs in dist/main...');
renameJsToCjs(distMainPath);
console.log('Done!');
