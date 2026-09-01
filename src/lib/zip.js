// Lecture / écriture de fichiers ZIP sans dépendance externe.
// Un .xlsx est un ZIP de fichiers XML : c'est tout ce dont l'application a besoin
// pour lire les listes d'appel et pour recopier les appels dans le fichier Excel.

const SIG_EOCD = 0x06054b50;
const SIG_CD = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

let crcTable = null;
function crc32Table() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

export function crc32(bytes) {
  const t = crc32Table();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Ce navigateur ne sait pas décompresser les fichiers .xlsx (mets-le à jour).");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Ouvre un ZIP et renvoie une Map nom -> entrée (données encore compressées).
 */
export function readZip(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let eocd = -1;
  const from = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= from; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Fichier illisible : ce n'est pas un fichier .xlsx valide.");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const entries = new Map();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== SIG_CD) break;
    const flags = view.getUint16(ptr + 8, true);
    const method = view.getUint16(ptr + 10, true);
    const crc = view.getUint32(ptr + 16, true);
    const compSize = view.getUint32(ptr + 20, true);
    const uncompSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(buf.subarray(ptr + 46, ptr + 46 + nameLen));

    if (view.getUint32(localOffset, true) === SIG_LOCAL) {
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      entries.set(name, {
        name,
        method,
        flags,
        crc,
        compSize,
        uncompSize,
        compressed: buf.subarray(start, start + compSize),
      });
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Décompresse une entrée et renvoie les octets. */
export async function entryBytes(entry) {
  if (!entry) return new Uint8Array(0);
  if (entry.method === 0) return entry.compressed;
  if (entry.method === 8) return inflateRaw(entry.compressed);
  throw new Error(`Compression ZIP non gérée (${entry.method}).`);
}

/** Décompresse une entrée et renvoie le texte. */
export async function entryText(entry) {
  return decoder.decode(await entryBytes(entry));
}

/**
 * Écrit un ZIP.
 * files : [{ name, text }] | [{ name, bytes }] | [{ name, copyOf: entrée }]
 */
export async function writeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    let method = 0;
    let crc;
    let compressed;
    let uncompSize;

    if (file.copyOf) {
      method = file.copyOf.method;
      crc = file.copyOf.crc;
      compressed = file.copyOf.compressed;
      uncompSize = file.copyOf.uncompSize;
    } else {
      const raw = file.bytes ? file.bytes : encoder.encode(file.text ?? "");
      crc = crc32(raw);
      uncompSize = raw.length;
      const packed = raw.length > 256 ? await deflateRaw(raw) : null;
      if (packed && packed.length < raw.length) {
        method = 8;
        compressed = packed;
      } else {
        method = 0;
        compressed = raw;
      }
    }

    const nameBytes = encoder.encode(file.name);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // noms de fichiers en UTF-8
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true); // heure
    lv.setUint16(12, 0x21, true); // date (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, uncompSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, compressed);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, SIG_CD, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, uncompSize, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + compressed.length;
  }

  const cdBytes = central.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, SIG_EOCD, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cdBytes, true);
  ev.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, eocd], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
