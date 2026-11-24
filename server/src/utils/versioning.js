import crypto from 'node:crypto';
import { isPngBuffer } from '../parsers/pngCard.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Recursively produce a deterministic JSON string with sorted object keys
 * so formatting or key-order differences don't produce different hashes.
 */
export function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalStringify(v)).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
}

/**
 * Strip `chara` and `ccv3` text chunks from a PNG buffer to isolate the visual image payload.
 */
function stripCharaChunks(pngBuf) {
  if (!isPngBuffer(pngBuf)) return pngBuf;
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

    if (!skip) {
      chunks.push(pngBuf.subarray(pos, chunkEnd));
    }

    if (type === 'IEND') break;
    pos = chunkEnd;
  }

  return Buffer.concat(chunks);
}

/**
 * Compute a SHA-256 content hash that uniquely identifies the entire asset content.
 * - JSON files: canonicalized JSON content
 * - PNG character cards: image pixels/chunks (without chara/ccv3) + canonicalized JSON
 */
export function computeContentHash(buffer, format, parsedJson = null) {
  const hash = crypto.createHash('sha256');
  if (format === 'png' || isPngBuffer(buffer)) {
    const imageOnly = stripCharaChunks(buffer);
    const imageDigest = crypto.createHash('sha256').update(imageOnly).digest('hex');
    hash.update('png:');
    hash.update(imageDigest);
    if (parsedJson !== null && parsedJson !== undefined) {
      hash.update(':');
      hash.update(canonicalStringify(parsedJson));
    }
  } else {
    hash.update('json:');
    if (parsedJson !== null && parsedJson !== undefined) {
      hash.update(canonicalStringify(parsedJson));
    } else {
      hash.update(buffer);
    }
  }
  return hash.digest('hex');
}

/**
 * Grouping key for items that share the same category and name (case-insensitive, trimmed).
 */
export function getGroupKey(item) {
  const cat = String(item.category || '').trim().toLowerCase();
  const name = String(item.name || '').trim().toLowerCase();
  return `${cat}::${name}`;
}

/**
 * Parse a version string like "1.8", "v1.10.2", "V2.0-beta" into comparable parts.
 * Returns null if the string does not start with a recognizable numeric version.
 */
export function parseVersion(ver) {
  if (!ver || typeof ver !== 'string') return null;
  const cleaned = ver
    .trim()
    .replace(/^(?:version|ver\.?|v|#)\s*/i, '')
    .trim();
  if (!cleaned) return null;

  // Prefer a leading numeric version, otherwise extract an embedded version like "正式重制v1.1" or "导演剪辑版1.1"
  const match =
    cleaned.match(/^(\d+(?:\.\d+)*)(.*)$/) ||
    cleaned.match(/(?:version|ver\.?|v)\s*(\d+(?:\.\d+)*)(.*)$/i) ||
    cleaned.match(/(\d+(?:\.\d+)+)(.*)$/);
  if (!match) return null;

  const parts = match[1].split('.').map((n) => Number.parseInt(n, 10));
  const suffix = (match[2] || '').trim().toLowerCase();
  const isPreRelease = /^[-_.\s]*(alpha|a\d*|beta|b\d*|rc\d*|dev|pre|preview|wip|test|snapshot)/i.test(suffix);

  return { parts, suffix, isPreRelease };
}

/**
 * Compare two items within the same name group so the NEWEST version comes first (DESC).
 * - If both have parseable version numbers, compare numerically (1.10 > 1.9 > 1.8).
 * - Otherwise (or if version numbers are equal), fall back to created_at DESC (latest import first).
 */
export function compareVersionsDesc(a, b) {
  const va = parseVersion(a.version);
  const vb = parseVersion(b.version);

  if (va && vb) {
    const maxLen = Math.max(va.parts.length, vb.parts.length);
    for (let i = 0; i < maxLen; i++) {
      const pa = va.parts[i] ?? 0;
      const pb = vb.parts[i] ?? 0;
      if (pa !== pb) return pb - pa;
    }
    if (va.isPreRelease !== vb.isPreRelease) {
      return va.isPreRelease ? 1 : -1;
    }
  }

  // Fallback to import timestamp (created_at DESC)
  const createdCmp = String(b.created_at || '').localeCompare(String(a.created_at || ''));
  if (createdCmp !== 0) return createdCmp;

  const updatedCmp = String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
  if (updatedCmp !== 0) return updatedCmp;

  // Tie-breaker: prefer item with a version string
  const hasVa = va ? 1 : 0;
  const hasVb = vb ? 1 : 0;
  if (hasVa !== hasVb) return hasVb - hasVa;

  return String(b.id || '').localeCompare(String(a.id || ''));
}

/**
 * Group serialized items by (category, normalized name), picking the newest version
 * as the representative item and attaching `version_count`.
 */
export function groupItemsByName(items) {
  const groups = new Map();
  for (const item of items) {
    const key = getGroupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const result = [];
  for (const group of groups.values()) {
    group.sort(compareVersionsDesc);
    const primary = group[0];

    let maxUpdated = primary.updated_at || '';
    let maxCreated = primary.created_at || '';
    for (let i = 1; i < group.length; i++) {
      if ((group[i].updated_at || '') > maxUpdated) maxUpdated = group[i].updated_at;
      if ((group[i].created_at || '') > maxCreated) maxCreated = group[i].created_at;
    }

    result.push({
      ...primary,
      version_count: group.length,
      _group_updated_at: maxUpdated,
      _group_created_at: maxCreated,
    });
  }

  return result;
}
