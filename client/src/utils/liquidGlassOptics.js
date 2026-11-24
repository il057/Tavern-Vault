/**
 * Liquid Glass Optical Engine
 *
 * Implements curved-bezel Snell refraction displacement maps for SVG <feDisplacementMap>,
 * analytical rounded-rectangle surface normals, flat interior centers, LRU caching,
 * and Chromium live backdrop-filter capability detection.
 *
 * MIT License — Adapted from:
 * - rdev/liquid-glass-react (ac48eab18d1f7f444ae30002d240cae29c863a21)
 * - 9und30/glassy-liquid (2361eb1f03979703db988180028ccc6d5fc23fe5)
 * - shuding/liquid-glass (a2d2e847f793430e3409a52927af815a23f4d372)
 */

let cachedChromiumSupport = null;

// Cache displacement maps by quantized geometry so grids of cards share maps instantaneously
const displacementCache = new Map();
const MAX_CACHE_ENTRIES = 48;

/**
 * Live SVG backdrop-filter (`backdrop-filter: url(#id)`) is currently supported
 * in Chromium-based browsers. Safari and Firefox fall back to specular glass + 1px glint.
 */
export function isChromiumBackdropSupported() {
  if (cachedChromiumSupport !== null) return cachedChromiumSupport;
  if (typeof navigator === 'undefined' || typeof CSS === 'undefined') {
    cachedChromiumSupport = false;
    return false;
  }
  const ua = navigator.userAgent || '';
  const isChromium = /Chrome|Chromium|Edg|OPR|Brave/i.test(ua) && !/Firefox|FxiOS/i.test(ua);
  const supportsBackdrop =
    CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
  cachedChromiumSupport = isChromium && supportsBackdrop;
  return cachedChromiumSupport;
}

/**
 * Signed distance to a rounded rectangle centered at (0, 0).
 * Negative inside, 0 on boundary, positive outside.
 */
function roundedRectSDF(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - (halfW - r);
  const qy = Math.abs(py) - (halfH - r);
  const outX = Math.max(qx, 0);
  const outY = Math.max(qy, 0);
  return Math.hypot(outX, outY) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Analytical outward unit normal of a rounded rectangle at (px, py).
 */
function roundedRectNormal(px, py, halfW, halfH, r) {
  const cx = halfW - r;
  const cy = halfH - r;
  const ax = Math.abs(px);
  const ay = Math.abs(py);

  if (ax > cx && ay > cy) {
    // Corner arc region
    const dx = ax - cx;
    const dy = ay - cy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      nx: (Math.sign(px) || 1) * (dx / len),
      ny: (Math.sign(py) || 1) * (dy / len),
    };
  }

  // Flat edge region: pick nearest edge
  const distX = halfW - ax;
  const distY = halfH - ay;
  if (distX < distY) {
    return { nx: Math.sign(px) || 1, ny: 0 };
  }
  return { nx: 0, ny: Math.sign(py) || 1 };
}

/**
 * Generates a PNG data URL encoding X (Red) and Y (Green) displacement vectors
 * for SVG <feDisplacementMap>, plus the maximum pixel displacement scale.
 *
 * - Center remains flat (neutral 128, 128) so text/icons stay crisp.
 * - Refraction is concentrated in a curved bezel band (8-26px) near the perimeter.
 * - Results are cached by quantized geometry for smooth 60fps card grids.
 */
export function buildDisplacementMap({
  width,
  height,
  radius = 999,
  bezelWidth = 16,
  ior = 1.48,
  maxDim = 320,
  strength = 1,
}) {
  const w = Math.max(16, Math.round(width));
  const h = Math.max(16, Math.round(height));

  // Clamp canvas resolution to <= 320px; SVG feImage smoothly interpolates the gradient
  const effectiveMaxDim = Math.min(maxDim, 320);
  const scaleFactor = Math.max(w, h) > effectiveMaxDim ? effectiveMaxDim / Math.max(w, h) : 1;
  const cw = Math.max(16, Math.round(w * scaleFactor));
  const ch = Math.max(16, Math.round(h * scaleFactor));

  const effRadius = Math.min(radius * scaleFactor, cw / 2, ch / 2);
  const effBezel = Math.max(6, Math.min(bezelWidth * scaleFactor, Math.min(cw, ch) * 0.42));

  // Strong, crisp optical refraction at the curved rim while keeping center flat
  const baseDisp = Math.min(48, Math.max(16, Math.min(w, h) * 0.68));
  const maxDisp = Math.max(6, Math.round(baseDisp * strength));

  if (typeof document === 'undefined') {
    return { dataUrl: '', maxDisp, width: w, height: h };
  }

  // Quantize to 8px buckets so similarly sized surfaces share one cached displacement PNG
  const qW = Math.max(16, Math.round(cw / 8) * 8);
  const qH = Math.max(16, Math.round(ch / 8) * 8);
  const qR = Math.round(effRadius);
  const qB = Math.round(effBezel);
  const cacheKey = `${qW}x${qH}:${qR}:${qB}:${ior}`;

  const cached = displacementCache.get(cacheKey);
  if (cached) {
    return { dataUrl: cached, maxDisp, width: w, height: h };
  }

  const canvas = document.createElement('canvas');
  canvas.width = qW;
  canvas.height = qH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', maxDisp, width: w, height: h };
  }

  const imgData = ctx.createImageData(qW, qH);
  const data = imgData.data;

  // Bulk-fill entire buffer with neutral displacement (R=128, G=128, B=128, A=255)
  const u32 = new Uint32Array(data.buffer);
  u32.fill(0xff808080);

  const halfW = qW / 2;
  const halfH = qH / 2;
  const rClamped = Math.min(qR, halfW, halfH);
  const bClamped = Math.max(5, Math.min(qB, Math.min(qW, qH) * 0.42));

  // Inner flat bounding box that is guaranteed to have distInside >= bClamped
  const innerFlatHalfW = Math.max(0, halfW - bClamped - 1);
  const innerFlatHalfH = Math.max(0, halfH - bClamped - 1);

  for (let y = 0; y < qH; y++) {
    const py = y + 0.5 - halfH;
    const inFlatY = Math.abs(py) < innerFlatHalfH;

    for (let x = 0; x < qW; x++) {
      const px = x + 0.5 - halfW;

      // Fast-skip flat interior band
      if (inFlatY && Math.abs(px) < innerFlatHalfW) {
        const skipTo = Math.floor(halfW + innerFlatHalfW) - 1;
        if (skipTo > x) x = skipTo;
        continue;
      }

      const sdf = roundedRectSDF(px, py, halfW, halfH, rClamped);
      const distInside = -sdf;

      if (distInside <= 0 || distInside >= bClamped) {
        continue;
      }

      // Normalized bezel coordinate t in [0, 1] (0 at outer edge, 1 at inner bezel boundary)
      const t = distInside / bClamped;
      // Curved bezel refraction profile (Snell-inspired steep rim -> flat center)
      const refractedMag = Math.pow(1 - t, 1.55);

      const { nx, ny } = roundedRectNormal(px, py, halfW, halfH, rClamped);
      // Inward-bending lens refraction
      const dx = -nx * refractedMag;
      const dy = -ny * refractedMag;

      const idx = (y * qW + x) * 4;
      data[idx] = Math.round(128 + dx * 127);
      data[idx + 1] = Math.round(128 + dy * 127);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');

  if (displacementCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = displacementCache.keys().next().value;
    displacementCache.delete(oldestKey);
  }
  displacementCache.set(cacheKey, dataUrl);

  return {
    dataUrl,
    maxDisp,
    width: w,
    height: h,
  };
}
