import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Sites serves the existing Angular app as static files. Sync/authentication
// remain with the app's original providers; this package supplies no API.
const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const [buildDirectory, previousDirectory] = process.argv.slice(2);
if (!buildDirectory || !existsSync(path.join(buildDirectory, 'index.html'))) {
  throw new Error('Pass the Angular browser build directory containing index.html.');
}
const source = realpathSync(path.resolve(buildDirectory));
const destination = path.resolve(root, 'dist');
if (
  path.dirname(destination) !== root ||
  source === destination ||
  source.startsWith(`${destination}${path.sep}`) ||
  destination.startsWith(`${source}${path.sep}`) ||
  (existsSync(destination) && lstatSync(destination).isSymbolicLink())
) {
  throw new Error(
    'Static output must be an unlinked dist directory inside this package.',
  );
}
// Preserve immutable chunks for open tabs while dropping retired API assets,
// old HTML and old Worker output. Neither runtime storage nor R2 is accessed.
const retained = [];
if (previousDirectory && existsSync(previousDirectory)) {
  const previous = realpathSync(path.resolve(previousDirectory));
  if (previous === destination || previous.startsWith(`${destination}${path.sep}`)) {
    throw new Error('Previous chunks must come from a separate directory.');
  }
  for (const name of readdirSync(previous)) {
    if (/^[\w.-]+-[\w-]+\.(?:js|css)$/.test(name)) retained.push([previous, name]);
  }
}
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
for (const [directory, name] of retained) {
  cpSync(path.join(directory, name), path.join(destination, name));
}
cpSync(source, destination, { recursive: true });
console.log(
  'Prepared static Angular Site. No authentication backend or cloud publication performed.',
);
