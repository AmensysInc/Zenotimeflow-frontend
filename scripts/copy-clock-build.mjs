#!/usr/bin/env node
/**
 * Copies the Expo web build (mobile/dist-web) into the main app's dist/clock
 * so the Clock In flow is served at /clock when deploying the web app.
 */
import { cpSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = join(root, 'mobile', 'dist-web');
const dest = join(root, 'dist', 'clock');

if (!existsSync(source)) {
  console.error('Missing mobile/dist-web. Run: cd mobile && npm run build:web');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(source, dest, { recursive: true });
console.log('Copied mobile/dist-web -> dist/clock');
