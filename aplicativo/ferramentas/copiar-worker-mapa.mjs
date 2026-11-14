import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origem = path.join(raiz, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const pastaPublica = path.join(raiz, 'public');
const destino = path.join(pastaPublica, 'maplibre-gl-worker.mjs');

await mkdir(pastaPublica, { recursive: true });
await copyFile(origem, destino);
console.log('Worker do MapLibre copiado para public/maplibre-gl-worker.mjs');
