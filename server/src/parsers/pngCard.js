import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Precompute CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function isPngBuffer(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

/**
 * Parse PNG tEXt / iTXt / zTXt chunks and extract SillyTavern character card JSON.
 * Prefers `ccv3` over `chara`.
 */
export function extractCharaFromPng(buf) {
  if (!isPngBuffer(buf)) {
    throw new Error('Invalid PNG signature');
  }

  const textChunks = new Map();
  let pos = 8;

  while (pos + 12 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > buf.length) break;

    if (type === 'tEXt') {
      const data = buf.subarray(dataStart, dataEnd);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const keyword = data.toString('latin1', 0, nullIdx).toLowerCase();
        const value = data.toString('latin1', nullIdx + 1);
        textChunks.set(keyword, value);
      }
    } else if (type === 'zTXt') {
      const data = buf.subarray(dataStart, dataEnd);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1 && nullIdx + 2 <= data.length) {
        const keyword = data.toString('latin1', 0, nullIdx).toLowerCase();
        const compressionMethod = data[nullIdx + 1];
        if (compressionMethod === 0) {
          try {
            const inflated = zlib.inflateSync(data.subarray(nullIdx + 2));
            textChunks.set(keyword, inflated.toString('latin1'));
          } catch {
            // ignore corrupted zTXt
          }
        }
      }
    } else if (type === 'iTXt') {
      const data = buf.subarray(dataStart, dataEnd);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1 && nullIdx + 3 <= data.length) {
        const keyword = data.toString('latin1', 0, nullIdx).toLowerCase();
        const compressionFlag = data[nullIdx + 1];
        // Skip language tag and translated keyword (2 null terminators)
        const langNull = data.indexOf(0, nullIdx + 3);
        const transNull = langNull !== -1 ? data.indexOf(0, langNull + 1) : -1;
        if (transNull !== -1) {
          const textBuf = data.subarray(transNull + 1);
          try {
            const value = compressionFlag === 1
              ? zlib.inflateSync(textBuf).toString('utf8')
              : textBuf.toString('utf8');
            textChunks.set(keyword, value);
          } catch {
            // ignore corrupted iTXt
          }
        }
      }
    } else if (type === 'IEND') {
      break;
    }

    pos = dataEnd + 4;
  }

  const rawBase64 = textChunks.get('ccv3') || textChunks.get('chara');
  const sourceChunk = textChunks.has('ccv3') ? 'ccv3' : (textChunks.has('chara') ? 'chara' : null);

  if (!rawBase64) {
    return null;
  }

  const jsonString = Buffer.from(rawBase64.trim(), 'base64').toString('utf8');
  const parsed = JSON.parse(jsonString);
  return {
    data: parsed,
    sourceChunk,
    hasCcv3: textChunks.has('ccv3'),
    hasChara: textChunks.has('chara'),
  };
}

function makeTextChunk(keyword, text) {
  const keyBuf = Buffer.from(keyword, 'latin1');
  const zero = Buffer.from([0]);
  const textBuf = Buffer.from(text, 'latin1');
  const payload = Buffer.concat([keyBuf, zero, textBuf]);

  const typeBuf = Buffer.from('tEXt', 'ascii');
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(payload.length, 0);

  const crcInput = Buffer.concat([typeBuf, payload]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lengthBuf, typeBuf, payload, crcBuf]);
}

/**
 * Embed SillyTavern character JSON into a PNG buffer as `chara` and `ccv3` tEXt chunks,
 * stripping any existing `chara` / `ccv3` chunks first.
 */
export function embedCharaIntoPng(pngBuf, cardJson) {
  if (!isPngBuffer(pngBuf)) {
    throw new Error('Cover image must be a valid PNG file to export as a PNG character card');
  }

  const base64 = Buffer.from(JSON.stringify(cardJson), 'utf8').toString('base64');
  const chunks = [PNG_SIGNATURE];
  let pos = 8;

  while (pos + 12 <= pngBuf.length) {
    const length = pngBuf.readUInt32BE(pos);
    const type = pngBuf.toString('ascii', pos + 4, pos + 8);
    const chunkEnd = pos + 12 + length;
    if (chunkEnd > pngBuf.length) break;

    let skip = false;
    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      const data = pngBuf.subarray(pos + 8, pos + 8 + length);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const kw = data.toString('latin1', 0, nullIdx).toLowerCase();
        if (kw === 'chara' || kw === 'ccv3') {
          skip = true;
        }
      }
    }

    if (type === 'IEND') {
      chunks.push(makeTextChunk('chara', base64));
      if (cardJson?.spec === 'chara_card_v3') {
        chunks.push(makeTextChunk('ccv3', base64));
      }
      chunks.push(pngBuf.subarray(pos, chunkEnd));
      break;
    }

    if (!skip) {
      chunks.push(pngBuf.subarray(pos, chunkEnd));
    }

    pos = chunkEnd;
  }

  return Buffer.concat(chunks);
}
