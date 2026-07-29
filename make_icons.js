const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'frontend', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function makePNG(size, outPath) {
  const w = size, h = size;

  function crc32(buf) {
    const t = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const tc = Buffer.from(type);
    const crcBuf = Buffer.concat([tc, data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(crcBuf));
    return Buffer.concat([len, tc, data, c]);
  }

  const pixels = [];
  for (let y = 0; y < h; y++) {
    pixels.push(0); // filter byte
    for (let x = 0; x < w; x++) {
      const cx = (x - w / 2) / w;
      const cy = (y - h / 2) / h;

      // Rounded rect background
      const pad = 0.08;
      const rad = 0.15;
      const ax = Math.abs(cx) - (0.5 - pad - rad);
      const ay = Math.abs(cy) - (0.5 - pad - rad);
      const inBg = Math.abs(cx) < 0.5 - pad && Math.abs(cy) < 0.5 - pad &&
        (ax < 0 || ay < 0 || ax * ax + ay * ay < rad * rad);

      // K letter
      const stemW = 0.045;
      const textH = 0.27;
      const armW = 0.045;
      const inStem = cx > -0.17 && cx < -0.17 + stemW * 2 && Math.abs(cy) < textH;
      const armSlope = cy < 0
        ? (cy - (-textH)) / (0 - (-textH))
        : cy / textH;
      const armX = -0.04 + armSlope * 0.19;
      const inArm = Math.abs(cy) < textH && cx > -0.04 && cx < 0.17 &&
        Math.abs(cx - armX) < armW;
      const isLetter = inStem || inArm;

      if (inBg) {
        if (isLetter) {
          pixels.push(255, 255, 255, 255);
        } else {
          pixels.push(180, 83, 9, 255); // amber-800
        }
      } else {
        pixels.push(0, 0, 0, 0);
      }
    }
  }

  const raw = Buffer.from(pixels);
  const compressed = zlib.deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  const ihdr = chunk('IHDR', ihdrData);
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([sig, ihdr, idat, iend]);
  fs.writeFileSync(outPath, png);
  console.log('Written:', outPath, '(' + png.length + ' bytes)');
}

makePNG(192, path.join(outDir, 'icon-192.png'));
makePNG(512, path.join(outDir, 'icon-512.png'));

// Also create a simple favicon.svg
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#b45309"/>
  <text x="50" y="72" font-family="Arial,sans-serif" font-size="70" font-weight="bold" text-anchor="middle" fill="white">K</text>
</svg>`;
fs.writeFileSync(path.join(outDir, 'favicon.svg'), svg);
console.log('Written: favicon.svg');

console.log('All icons created successfully!');
