// One-off generator for the Midnight Bouncer PWA icons — a gold crescent
// moon on a midnight-navy background. No image libraries needed: this
// writes raw RGBA pixel buffers and hand-encodes them as PNG (signature +
// IHDR + IDAT + IEND chunks per the PNG spec), since this is a small repo
// that otherwise has no image-processing dependency to reach for.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const NAVY = [11, 16, 38, 255]; // #0b1026
const GOLD = [245, 215, 110, 255]; // #f5d76e

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk('IDAT', deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const moonR = size * 0.34;
  // The "bite" circle is offset up-right of the main moon circle, carving
  // out a crescent — classic two-circle-subtraction technique.
  const biteR = size * 0.30;
  const biteCx = cx + size * 0.16;
  const biteCy = cy - size * 0.1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dxMoon = x - cx;
      const dyMoon = y - cy;
      const inMoon = dxMoon * dxMoon + dyMoon * dyMoon <= moonR * moonR;
      const dxBite = x - biteCx;
      const dyBite = y - biteCy;
      const inBite = dxBite * dxBite + dyBite * dyBite <= biteR * biteR;
      const color = inMoon && !inBite ? GOLD : NAVY;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = color[3];
    }
  }
  return rgba;
}

const outDir = path.resolve(import.meta.dirname, '..', 'apps', 'demo', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

for (const size of [180, 192, 512]) {
  const png = encodePng(size, size, drawIcon(size));
  const outPath = path.join(outDir, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}
