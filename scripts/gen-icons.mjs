/* Genera los iconos PNG de la PWA (192 / 512 / maskable) sin dependencias externas. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// — CRC32 —
const table = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// — Dibujo —
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function drawIcon(size, artScale) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // Fondo: degradado vertical índigo
  const radius = size * 0.22 * artScale + size * (1 - artScale) * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = y / (size - 1);
      // SDF de rectángulo redondeado centrado
      const hw = size / 2;
      const qx = Math.abs(x - cx) - (hw - radius);
      const qy = Math.abs(y - cy) - (hw - radius);
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const a = clamp01(0.5 - d);
      const i = (y * size + x) * 4;
      buf[i] = Math.round(lerp(0x4f, 0x37, t));
      buf[i + 1] = Math.round(lerp(0x46, 0x30, t));
      buf[i + 2] = Math.round(lerp(0xe5, 0xa3, t));
      buf[i + 3] = Math.round(a * 255);
    }
  }
  const blend = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    const sa = a / 255;
    const da = buf[i + 3] / 255;
    const out = sa + da * (1 - sa);
    if (out <= 0) return;
    buf[i] = Math.round((r * sa + buf[i] * da * (1 - sa)) / out);
    buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / out);
    buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / out);
    buf[i + 3] = Math.round(out * 255);
  };
  const s = artScale;
  // Anillo de cámara (blanco)
  const ringC = { x: cx + size * 0.1 * s, y: cy + size * 0.08 * s };
  const ringR = size * 0.21 * s;
  const thick = size * 0.035 * s;
  // Punto REC (rojo)
  const dotC = { x: cx - size * 0.18 * s, y: cy - size * 0.16 * s };
  const dotR = size * 0.075 * s;
  const minX = Math.max(0, Math.floor(cx - size * 0.45 * s));
  const maxX = Math.min(size - 1, Math.ceil(cx + size * 0.45 * s));
  const minY = Math.max(0, Math.floor(cy - size * 0.45 * s));
  const maxY = Math.min(size - 1, Math.ceil(cy + size * 0.45 * s));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dr = Math.abs(Math.hypot(x - ringC.x, y - ringC.y) - ringR);
      const ringA = clamp01(0.5 - (dr - thick / 2));
      if (ringA > 0) blend(x, y, 255, 255, 255, Math.round(ringA * 255));
      const dd = Math.hypot(x - dotC.x, y - dotC.y) - dotR;
      const dotA = clamp01(0.5 - dd);
      if (dotA > 0) blend(x, y, 239, 68, 68, Math.round(dotA * 255));
    }
  }
  return buf;
}

const icon512 = drawIcon(512, 1);
writeFileSync(join(outDir, 'icon-512.png'), encodePNG(512, 512, icon512));
const icon192 = drawIcon(192, 1);
writeFileSync(join(outDir, 'icon-192.png'), encodePNG(192, 192, icon192));
// Maskable: arte al 72 % sobre fondo completo (zona de seguridad)
const maskable = drawIcon(512, 0.72);
writeFileSync(join(outDir, 'maskable-512.png'), encodePNG(512, 512, maskable));
console.log('Iconos generados en public/icons/');
