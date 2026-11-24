<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { buildDisplacementMap, isChromiumBackdropSupported } from '../utils/liquidGlassOptics.js';

const props = defineProps({
  tag: { type: String, default: 'div' },
  variant: { type: String, default: 'clear' }, // 'clear' | 'surface' | 'sheet' | 'tinted'
  radius: { type: [Number, String], default: 999 },
  bezelWidth: { type: Number, default: 24 },
  blur: { type: Number, default: 0 },
  saturate: { type: Number, default: 1.45 },
  dispersion: { type: Boolean, default: false },
  refraction: { type: Boolean, default: false },
  strength: { type: Number, default: 1 },
  maxDim: { type: Number, default: 320 },
  interactive: { type: Boolean, default: false },
  staticGlint: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
});

const hostRef = ref(null);
const glintRef = ref(null);
const uid = Math.random().toString(36).slice(2, 9);
const filterId = `lg-filter-${uid}`;

const box = ref({ width: 0, height: 0 });
const mapData = ref({ dataUrl: '', maxDisp: 10 });
const chromiumSupported = ref(false);

// Tactile spring state (only used when interactive=true)
const isPressed = ref(false);
const dragStretch = ref({ x: 0, y: 0 });

let dragStart = null;
let resizeObserver = null;
let resizeRaf = 0;
let glintRaf = 0;
let cachedRect = null;
let pendingPointer = null;

const useSiblingBackdrop = computed(() => props.variant === 'sheet');
const needsSvgRefraction = computed(
  () => !useSiblingBackdrop.value && props.refraction && chromiumSupported.value
);

const resolvedBlur = computed(() => {
  return Number.isFinite(props.blur) ? props.blur : 0;
});

const numericRadius = computed(() => {
  if (props.radius === 'pill' || props.radius === 999) return 999;
  const n = Number(props.radius);
  return Number.isFinite(n) ? n : 24;
});

function regenerateMap() {
  if (!needsSvgRefraction.value) return;
  const { width, height } = box.value;
  if (width < 12 || height < 12) return;
  mapData.value = buildDisplacementMap({
    width,
    height,
    radius: numericRadius.value,
    bezelWidth: props.bezelWidth,
    maxDim: props.maxDim,
    strength: props.strength,
  });
}

function setupResizeObserver() {
  if (resizeObserver || !needsSvgRefraction.value) return;
  const el = hostRef.value;
  if (!el) return;

  const applySize = (w, h) => {
    const rw = Math.round(w);
    const rh = Math.round(h);
    if (rw !== box.value.width || rh !== box.value.height) {
      box.value = { width: rw, height: rh };
      regenerateMap();
    }
  };

  const rect = el.getBoundingClientRect();
  applySize(rect.width, rect.height);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const borderBox = entry.borderBoxSize?.[0];
      const w = borderBox ? borderBox.inlineSize : entry.contentRect.width;
      const h = borderBox ? borderBox.blockSize : entry.contentRect.height;
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        applySize(w, h);
      });
    });
    resizeObserver.observe(el);
  }
}

function teardownResizeObserver() {
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = 0;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

onMounted(() => {
  chromiumSupported.value = isChromiumBackdropSupported();
  if (needsSvgRefraction.value) {
    setupResizeObserver();
  }
});

onBeforeUnmount(() => {
  teardownResizeObserver();
  if (glintRaf) {
    cancelAnimationFrame(glintRaf);
    glintRaf = 0;
  }
  cachedRect = null;
});

watch(needsSvgRefraction, (active) => {
  if (active) {
    setupResizeObserver();
  } else {
    teardownResizeObserver();
    mapData.value = { dataUrl: '', maxDisp: 10 };
  }
});

watch(
  () => [props.radius, props.bezelWidth, props.strength],
  () => regenerateMap()
);

function onPointerEnter() {
  if (!props.staticGlint && hostRef.value) {
    cachedRect = hostRef.value.getBoundingClientRect();
  }
}

function onPointerDown(e) {
  if (props.disabled) return;
  if (props.interactive) {
    isPressed.value = true;
    dragStart = { x: e.clientX, y: e.clientY };
  }
}

function flushGlint() {
  glintRaf = 0;
  const gEl = glintRef.value;
  if (!gEl || !pendingPointer || !cachedRect || cachedRect.width <= 0 || cachedRect.height <= 0) return;
  const x = Math.max(0, Math.min(100, ((pendingPointer.x - cachedRect.left) / cachedRect.width) * 100));
  const y = Math.max(0, Math.min(100, ((pendingPointer.y - cachedRect.top) / cachedRect.height) * 100));
  gEl.style.setProperty('--lg-gx', `${x.toFixed(1)}%`);
  gEl.style.setProperty('--lg-gy', `${y.toFixed(1)}%`);
  gEl.style.opacity = '0.72';
}

function onPointerMove(e) {
  if (!props.staticGlint) {
    if (!cachedRect && hostRef.value) {
      cachedRect = hostRef.value.getBoundingClientRect();
    }
    pendingPointer = { x: e.clientX, y: e.clientY };
    if (!glintRaf) {
      glintRaf = requestAnimationFrame(flushGlint);
    }
  }

  if (props.interactive && isPressed.value && dragStart) {
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const stretchX = Math.max(-0.04, Math.min(0.04, Math.abs(dx) * 0.0012));
    const stretchY = Math.max(-0.025, Math.min(0.025, Math.abs(dy) * 0.0008));
    dragStretch.value = { x: stretchX, y: stretchY };
  }
}

function resetSpring() {
  if (!isPressed.value && !dragStart) return;
  isPressed.value = false;
  dragStart = null;
  dragStretch.value = { x: 0, y: 0 };
}

function onPointerLeave() {
  cachedRect = null;
  pendingPointer = null;
  if (glintRaf) {
    cancelAnimationFrame(glintRaf);
    glintRaf = 0;
  }
  if (glintRef.value) {
    glintRef.value.style.opacity = '0';
  }
  resetSpring();
}

const backdropStyle = computed(() => {
  const borderRadius = numericRadius.value >= 999 ? '999px' : `${numericRadius.value}px`;
  const useSvg = needsSvgRefraction.value && Boolean(mapData.value.dataUrl);
  const blurPart = resolvedBlur.value > 0 ? ` blur(${resolvedBlur.value}px)` : '';
  const sat = Number.isFinite(props.saturate) ? props.saturate : 1.45;
  const backdropFilter = useSvg
    ? `url(#${filterId})${blurPart} saturate(${sat})`
    : resolvedBlur.value > 0
      ? `blur(${resolvedBlur.value}px) saturate(${sat})`
      : `blur(8px) saturate(${sat})`;

  let transform = '';
  if (props.interactive && isPressed.value) {
    const sx = (0.96 + dragStretch.value.x).toFixed(4);
    const sy = (0.96 - dragStretch.value.y * 0.5).toFixed(4);
    transform = `scale(${sx}, ${sy})`;
  }

  return {
    borderRadius,
    '--lg-backdrop': useSiblingBackdrop.value ? 'none' : backdropFilter,
    '--lg-sheet-backdrop': backdropFilter,
    transform: transform || undefined,
  };
});

const glintStaticVars = computed(() => {
  const size = props.variant === 'surface' || props.variant === 'sheet' ? '220px' : '150px';
  const alpha = props.variant === 'surface' ? '0.22' : '0.32';
  return {
    '--lg-gsize': size,
    '--lg-galpha': alpha,
  };
});
</script>

<template>
  <component
    :is="tag"
    ref="hostRef"
    class="liquid-glass-surface"
    :class="[
      `lg-${variant}`,
      {
        'lg-interactive': interactive,
        'lg-pressed': interactive && isPressed,
        'lg-disabled': disabled,
        'lg-refraction-active': needsSvgRefraction && Boolean(mapData.dataUrl),
      },
    ]"
    :style="backdropStyle"
    @pointerenter="staticGlint ? undefined : onPointerEnter($event)"
    @pointerdown="interactive ? onPointerDown($event) : undefined"
    @pointermove="staticGlint && !interactive ? undefined : onPointerMove($event)"
    @pointerup="interactive ? resetSpring() : undefined"
    @pointercancel="interactive ? resetSpring() : undefined"
    @pointerleave="staticGlint && !interactive ? undefined : onPointerLeave()"
  >
    <!-- Optical SVG Displacement Filter (Chromium live backdrop refraction, opt-in only) -->
    <svg
      v-if="needsSvgRefraction && mapData.dataUrl && box.width > 0 && box.height > 0"
      class="lg-svg-defs"
      aria-hidden="true"
      width="1"
      height="1"
    >
      <defs>
        <filter
          :id="filterId"
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          x="0"
          y="0"
          :width="box.width"
          :height="box.height"
          color-interpolation-filters="sRGB"
        >
          <feImage
            :href="mapData.dataUrl"
            x="0"
            y="0"
            :width="box.width"
            :height="box.height"
            preserveAspectRatio="none"
            result="dispMap"
          />
          <template v-if="dispersion">
            <!-- Optical RGB chromatic dispersion at curved edges -->
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              :scale="mapData.maxDisp * 1.18"
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispR"
            />
            <feColorMatrix
              in="dispR"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="redOnly"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              :scale="mapData.maxDisp"
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispG"
            />
            <feColorMatrix
              in="dispG"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="greenOnly"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              :scale="mapData.maxDisp * 0.82"
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispB"
            />
            <feColorMatrix
              in="dispB"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="blueOnly"
            />
            <feBlend in="redOnly" in2="greenOnly" mode="screen" result="rg" />
            <feBlend in="rg" in2="blueOnly" mode="screen" />
          </template>
          <feDisplacementMap
            v-else
            in="SourceGraphic"
            in2="dispMap"
            :scale="mapData.maxDisp"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>

    <!-- Isolated sibling backdrop layer for sheets (prevents Chromium iframe compositor blur bleed) -->
    <span v-if="useSiblingBackdrop" class="lg-sheet-backdrop" aria-hidden="true"></span>

    <!-- Directional Specular Rim & Pointer Glint Overlay -->
    <span class="lg-specular-rim" aria-hidden="true"></span>
    <span
      v-if="!staticGlint"
      ref="glintRef"
      class="lg-glint-layer"
      aria-hidden="true"
      :style="glintStaticVars"
    ></span>

    <slot />
  </component>
</template>

<style scoped>
.liquid-glass-surface {
  position: relative;
  backdrop-filter: var(--lg-backdrop);
  -webkit-backdrop-filter: var(--lg-backdrop);
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 160ms ease,
    border-color 160ms ease;
}

.liquid-glass-surface.lg-pressed {
  transition: transform 90ms cubic-bezier(0.2, 0, 0, 1);
}

/* Specular Curved-Bezel Rim (bright top-left & subtle bottom-right caustic edge) */
.lg-specular-rim {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.25px;
  pointer-events: none;
  z-index: 3;
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.82) 0%,
    rgba(255, 255, 255, 0.24) 30%,
    rgba(255, 255, 255, 0.08) 58%,
    rgba(255, 255, 255, 0.48) 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
}

:root[data-theme='dark'] .lg-specular-rim {
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.44) 0%,
    rgba(255, 255, 255, 0.14) 32%,
    rgba(255, 255, 255, 0.05) 60%,
    rgba(191, 219, 254, 0.28) 100%
  );
}

/* 1. Clear Liquid Glass (Header Bar, Floating Overlay Icon Buttons) */
.lg-clear {
  background: var(--lg-clear-bg);
  border: 1px solid rgba(255, 255, 255, 0.38);
  box-shadow:
    0 12px 32px rgba(10, 22, 42, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    inset 0 -1px 0 rgba(255, 255, 255, 0.2);
}

:root[data-theme='dark'] .lg-clear {
  border-color: rgba(255, 255, 255, 0.26);
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.36),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
}

/* 2. Surface Liquid Glass (Floating Sidebar, Archive Cards, List Rows) */
.lg-surface {
  background: var(--lg-surface-bg);
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--lg-surface-shadow);
}

:root[data-theme='dark'] .lg-surface {
  border-color: rgba(255, 255, 255, 0.2);
}

/* 3. Sheet Liquid Glass (Detail Drawer, Modals — sibling backdrop avoids Chromium iframe blur bleed) */
.lg-sheet {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.58);
  box-shadow: var(--elevation-transient);
  isolation: isolate;
}

.lg-sheet-backdrop {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--lg-sheet-bg);
  backdrop-filter: var(--lg-sheet-backdrop);
  -webkit-backdrop-filter: var(--lg-sheet-backdrop);
  pointer-events: none;
  z-index: 0;
}

:root[data-theme='dark'] .lg-sheet {
  border-color: rgba(255, 255, 255, 0.22);
}

/* 4. Tinted Pill Glass (Toasts, Compact Floating Badges) */
.lg-tinted {
  background: var(--lg-tinted-bg);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow:
    0 12px 32px rgba(10, 22, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    inset 0 -1px 0 rgba(255, 255, 255, 0.22);
}

:root[data-theme='dark'] .lg-tinted {
  border-color: rgba(255, 255, 255, 0.26);
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.34),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
}

.lg-svg-defs {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.lg-glint-layer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  background: radial-gradient(
    var(--lg-gsize, 180px) circle at var(--lg-gx, 50%) var(--lg-gy, 0%),
    rgba(255, 255, 255, var(--lg-galpha, 0.24)),
    transparent 70%
  );
  transition: opacity 180ms ease;
}

.lg-disabled {
  opacity: 0.48;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .liquid-glass-surface,
  .liquid-glass-surface.lg-pressed {
    transition: none;
    transform: none !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .liquid-glass-surface {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .lg-clear,
  .lg-surface,
  .lg-sheet,
  .lg-tinted {
    background: var(--surface-solid-content);
  }
}
</style>
