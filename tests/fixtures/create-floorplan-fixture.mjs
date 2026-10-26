// Reproducible PDF fixture. Uses only Node built-ins; no product dependency.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const objects = [];
const reserve = () => { objects.push(null); return objects.length; };
const set = (id, value) => { objects[id - 1] = Buffer.isBuffer(value) ? value : Buffer.from(value, 'ascii'); };
const stream = (data, dictionary = '') => {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data, 'ascii');
  return Buffer.concat([
    Buffer.from(`<< /Length ${bytes.length} ${dictionary} >>\nstream\n`, 'ascii'),
    bytes,
    Buffer.from('\nendstream', 'ascii'),
  ]);
};

const catalog = reserve();
const pages = reserve();
const font = reserve();
const vectorContent = reserve();
const vectorPage = reserve();
const rotatedContent = reserve();
const rotatedPage = reserve();
const rasterImage = reserve();
const rasterContent = reserve();
const rasterPage = reserve();

set(font, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
set(vectorContent, stream(`
q 1 1 1 rg 0 0 600 400 re f Q
0 G 2 w 60 70 480 260 re S
300 70 m 300 330 l S
BT /F1 15 Tf 60 370 Td (PAGE 1 - TWO ROOMS - VECTOR) Tj ET
BT /F1 13 Tf 147 195 Td (ROOM A) Tj ET
BT /F1 13 Tf 387 195 Td (ROOM B) Tj ET
BT /F1 11 Tf 118 346 Td (WALL = 4800 mm) Tj ET
0.5 w 60 338 m 300 338 l S 60 334 m 60 342 l S 300 334 m 300 342 l S
BT /F1 9 Tf 60 35 Td (Natural viewport: 600 x 400 pt. Calibration endpoints: 60,70 and 300,70.) Tj ET
`));
set(vectorPage, `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 600 400] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${vectorContent} 0 R >>`);

set(rotatedContent, stream(`
q 1 1 1 rg 0 0 600 400 re f Q
0 G 2 w 100 80 400 240 re S
BT /F1 15 Tf 90 355 Td (PAGE 2 - INTRINSIC ROTATION 90 DEGREES) Tj ET
BT /F1 14 Tf 238 200 Td (ROOM C) Tj ET
BT /F1 11 Tf 230 58 Td (WALL = 2000 mm) Tj ET
0.5 w 100 70 m 500 70 l S 100 66 m 100 74 l S 500 66 m 500 74 l S
BT /F1 9 Tf 100 25 Td (MediaBox: 600 x 400 pt; rotated viewport: 400 x 600 pt.) Tj ET
`));
set(rotatedPage, `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 600 400] /Rotate 90 /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${rotatedContent} 0 R >>`);

// This page contains a single image. It has no PDF text or vector room edges.
const imageWidth = 600;
const imageHeight = 400;
const pixels = Buffer.alloc(imageWidth * imageHeight, 255);
function fill(x, y, width, height, shade = 0) {
  for (let py = Math.max(0, y); py < Math.min(imageHeight, y + height); py++) {
    for (let px = Math.max(0, x); px < Math.min(imageWidth, x + width); px++) pixels[py * imageWidth + px] = shade;
  }
}
fill(100, 80, 401, 2); fill(100, 319, 401, 2);
fill(100, 80, 2, 241); fill(499, 80, 2, 241); fill(299, 80, 2, 241);
fill(100, 66, 201, 1); fill(100, 61, 1, 11); fill(300, 61, 1, 11);
// A tiny bitmap alphabet makes the scanned sheet recognisable without fonts.
const glyphs = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
};
function label(text, x, y, scale = 2) {
  for (const character of text) {
    const glyph = glyphs[character];
    if (glyph) glyph.forEach((row, dy) => [...row].forEach((value, dx) => { if (value === '1') fill(x + dx * scale, y + dy * scale, scale, scale); }));
    x += 6 * scale;
  }
}
label('SCAN', 100, 24, 3);
label('3000', 175, 46, 2);
label('A', 190, 190, 3); label('B', 390, 190, 3);
set(rasterImage, stream(deflateSync(pixels), `/Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`));
set(rasterContent, stream(`q 600 0 0 400 0 0 cm /Scan Do Q`));
set(rasterPage, `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 600 400] /Resources << /XObject << /Scan ${rasterImage} 0 R >> >> /Contents ${rasterContent} 0 R >>`);

set(pages, `<< /Type /Pages /Kids [${vectorPage} 0 R ${rotatedPage} 0 R ${rasterPage} 0 R] /Count 3 >>`);
set(catalog, `<< /Type /Catalog /Pages ${pages} 0 R >>`);

const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
const offsets = [0];
let cursor = chunks[0].length;
objects.forEach((object, index) => {
  offsets.push(cursor);
  const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'ascii'), object, Buffer.from('\nendobj\n', 'ascii')]);
  chunks.push(chunk); cursor += chunk.length;
});
const xref = cursor;
chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'ascii'));
writeFileSync(fileURLToPath(new URL('./grundriss-drei-seiten.pdf', import.meta.url)), Buffer.concat(chunks));

const expectations = {
  note: 'Coordinates use PDF.js natural viewport at scale 1, including intrinsic page rotation; origin is top-left.',
  pages: [
    { number: 1, width: 600, height: 400, rotation: 0, type: 'vector',
      calibration: { start: { x: 60, y: 70 }, end: { x: 300, y: 70 }, lengthMm: 4800, mmPerPoint: 20 },
      rooms: [
        { name: 'Raum A', points: [{ x: 60, y: 70 }, { x: 300, y: 70 }, { x: 300, y: 330 }, { x: 60, y: 330 }], widthMm: 4800, heightMm: 5200, areaM2: 24.96 },
        { name: 'Raum B', points: [{ x: 300, y: 70 }, { x: 540, y: 70 }, { x: 540, y: 330 }, { x: 300, y: 330 }], widthMm: 4800, heightMm: 5200, areaM2: 24.96 },
      ] },
    { number: 2, width: 400, height: 600, rotation: 90, type: 'vector-rotated',
      calibration: { start: { x: 80, y: 100 }, end: { x: 80, y: 500 }, lengthMm: 2000, mmPerPoint: 5 },
      rooms: [{ name: 'Raum C', points: [{ x: 80, y: 100 }, { x: 320, y: 100 }, { x: 320, y: 500 }, { x: 80, y: 500 }], widthMm: 1200, heightMm: 2000, areaM2: 2.4 }] },
    { number: 3, width: 600, height: 400, rotation: 0, type: 'raster',
      calibration: { start: { x: 100, y: 80 }, end: { x: 300, y: 80 }, lengthMm: 3000, mmPerPoint: 15 },
      rooms: [
        { name: 'Scan A', points: [{ x: 100, y: 80 }, { x: 300, y: 80 }, { x: 300, y: 320 }, { x: 100, y: 320 }], widthMm: 3000, heightMm: 3600, areaM2: 10.8 },
        { name: 'Scan B', points: [{ x: 300, y: 80 }, { x: 500, y: 80 }, { x: 500, y: 320 }, { x: 300, y: 320 }], widthMm: 3000, heightMm: 3600, areaM2: 10.8 },
      ] },
  ],
};
writeFileSync(fileURLToPath(new URL('./grundriss-erwartungen.json', import.meta.url)), `${JSON.stringify(expectations, null, 2)}\n`);
console.log('Created grundriss-drei-seiten.pdf and grundriss-erwartungen.json.');
