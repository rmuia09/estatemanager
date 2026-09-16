const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}
function encodePng(size, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const TEAL = [15, 118, 110]
const WHITE = [255, 255, 255]
const DK = [9, 90, 84]

function draw(size) {
  const px = Buffer.alloc(size * size * 4)
  const F = size / 512
  const inRounded = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 + r && y < y0 + r) { const dx = x0 + r - x, dy = y0 + r - y; return dx * dx + dy * dy <= r * r }
    if (x > x1 - r && y < y0 + r) { const dx = x - (x1 - r), dy = y0 + r - y; return dx * dx + dy * dy <= r * r }
    if (x < x0 + r && y > y1 - r) { const dx = x0 + r - x, dy = y - (y1 - r); return dx * dx + dy * dy <= r * r }
    if (x > x1 - r && y > y1 - r) { const dx = x - (x1 - r), dy = y - (y1 - r); return dx * dx + dy * dy <= r * r }
    return x >= x0 && x <= x1 && y >= y0 && y <= y1
  }
  const inTri = (x, y) => {
    const x0 = 256 * F, y0 = 82 * F, x1 = 112 * F, y1 = 220 * F, x2 = 400 * F, y2 = 220 * F
    const d1 = (x - x2) * (y0 - y2) - (x0 - x2) * (y - y2)
    const d2 = (x - x0) * (y1 - y0) - (x1 - x0) * (y - y0)
    const d3 = (x - x1) * (y2 - y1) - (x2 - x1) * (y - y1)
    const h = (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)
    return h
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      let c = TEAL
      if (!inRounded(x + 0.5, y + 0.5, 12 * F, 12 * F, size - 12 * F, size - 12 * F, 108 * F)) {
        px[i + 3] = 0
        continue
      }
      const house = x >= 152 * F && x <= 360 * F && y >= 196 * F && y <= 396 * F
      const roof = inTri(x + 0.5, y + 0.5)
      const door = x >= 218 * F && x <= 294 * F && y >= 296 * F && y <= 396 * F
      const windowL = x >= 174 * F && x <= 216 * F && y >= 226 * F && y <= 268 * F
      const windowR = x >= 296 * F && x <= 338 * F && y >= 226 * F && y <= 268 * F
      if (house) c = WHITE
      else if (roof) c = WHITE
      if (house && (door || windowL || windowR)) c = TEAL
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255
      void DK
    }
  }
  return px
}

const outDir = path.join(__dirname, '..', 'client', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 }
for (const [name, size] of Object.entries(sizes)) {
  fs.writeFileSync(path.join(outDir, name), encodePng(size, draw(size)))
  console.log('wrote', path.join(outDir, name), `(${size}x${size})`)
}