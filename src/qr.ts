/** QR codes as PNG, small enough to inline in an email without a canvas. */
import qrcode from "qrcode-generator";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = (CRC_TABLE[(crc ^ bytes[i]!) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(new TextEncoder().encode(type), 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput));
  return out;
}

/** zlib stream with stored blocks — valid, and no compressor needed in the Worker. */
function zlibStore(raw: Uint8Array): Uint8Array {
  const blocks: number[] = [0x78, 0x01];
  let offset = 0;
  while (offset < raw.length) {
    const size = Math.min(65535, raw.length - offset);
    const last = offset + size >= raw.length ? 1 : 0;
    blocks.push(last, size & 0xff, (size >>> 8) & 0xff, ~size & 0xff, (~size >>> 8) & 0xff);
    for (let i = 0; i < size; i += 1) blocks.push(raw[offset + i]!);
    offset += size;
  }
  let a = 1;
  let b = 0;
  for (let i = 0; i < raw.length; i += 1) {
    a = (a + raw[i]!) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;
  blocks.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff);
  return new Uint8Array(blocks);
}

/** Renders `text` as a grayscale PNG QR code. */
export function qrPng(text: string, options: { scale?: number; margin?: number } = {}): Uint8Array {
  const scale = Math.max(1, Math.round(options.scale ?? 6));
  const margin = Math.max(0, Math.round(options.margin ?? 2));
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const modules = qr.getModuleCount();
  const size = (modules + margin * 2) * scale;

  const raw = new Uint8Array((size + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size + 1);
    raw[rowStart] = 0; // filter: none
    const moduleY = Math.floor(y / scale) - margin;
    for (let x = 0; x < size; x += 1) {
      const moduleX = Math.floor(x / scale) - margin;
      const dark =
        moduleY >= 0 && moduleY < modules && moduleX >= 0 && moduleX < modules && qr.isDark(moduleY, moduleX);
      raw[rowStart + 1 + x] = dark ? 0 : 255;
    }
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [signature, chunk("IHDR", ihdr), chunk("IDAT", zlibStore(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** The link a PayPal QR points at, with the amount baked in so the payer types nothing. */
export function paypalLink(handle: string, amount: number): string {
  const clean = handle.replace(/^@/, "").replace(/[^A-Za-z0-9._-]/g, "");
  const value = amount > 0 ? `/${amount.toFixed(2)}` : "";
  return `https://paypal.me/${clean}${value}`;
}
