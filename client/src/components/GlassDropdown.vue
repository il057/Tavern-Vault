<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';
import LiquidGlass from './LiquidGlass.vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  placeholder: { type: String, default: '请选择' },
  variant: { type: String, default: 'field' }, // 'header' | 'field'
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'change']);

const isOpen = ref(false);
const rootRef = ref(null);
const triggerRef = ref(null);
const menuWrapRef = ref(null);
const activeIndex = ref(-1);
const menuStyle = ref({});

const selectedOption = computed(() =>
  props.options.find((opt) => opt.value === props.modelValue)
);

function updatePosition() {
  const el = rootRef.value || triggerRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const estimatedHeight = Math.min(360, props.options.length * 39 + 16);
  const viewportW = document.documentElement.clientWidth || window.innerWidth;
  const viewportH = document.documentElement.clientHeight || window.innerHeight;
  const spaceBelow = viewportH - rect.bottom;
  const openUp = spaceBelow < estimatedHeight + 12 && rect.top > estimatedHeight + 12;

  const width = Math.max(rect.width, 176);
  let left = rect.left;
  if (left + width > viewportW - 8) {
    left = Math.max(8, viewportW - width - 8);
  }
  if (left < 8) left = 8;

  menuStyle.value = {
    position: 'fixed',
    left: `${left.toFixed(2)}px`,
    width: `${width.toFixed(2)}px`,
    top: openUp ? 'auto' : `${(rect.bottom + 6).toFixed(2)}px`,
    bottom: openUp ? `${(viewportH - rect.top + 6).toFixed(2)}px` : 'auto',
    zIndex: 240,
  };
}

async function openMenu() {
  if (props.disabled) return;
  updatePosition();
  isOpen.value = true;
  const currentIdx = props.options.findIndex((o) => o.value === props.modelValue);
  activeIndex.value = currentIdx >= 0 ? currentIdx : 0;
  await nextTick();
  updatePosition();
}

function closeMenu() {
  isOpen.value = false;
  activeIndex.value = -1;
}

function toggleMenu() {
  if (isOpen.value) closeMenu();
  else openMenu();
}

function selectOption(opt) {
  emit('update:modelValue', opt.value);
  emit('change', opt.value);
  closeMenu();
  triggerRef.value?.focus();
}

function onTriggerKeydown(e) {
  if (props.disabled) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (isOpen.value && activeIndex.value >= 0 && props.options[activeIndex.value]) {
      selectOption(props.options[activeIndex.value]);
    } else {
      openMenu();
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!isOpen.value) {
      openMenu();
    } else if (props.options.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % props.options.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!isOpen.value) {
      openMenu();
    } else if (props.options.length > 0) {
      activeIndex.value = (activeIndex.value - 1 + props.options.length) % props.options.length;
    }
  } else if (e.key === 'Escape' && isOpen.value) {
    e.preventDefault();
    closeMenu();
  }
}

function onDocumentClick(e) {
  if (!isOpen.value) return;
  const target = e.target;
  if (triggerRef.value?.contains(target) || menuWrapRef.value?.contains(target)) return;
  closeMenu();
}

function onViewportChange() {
  if (isOpen.value) updatePosition();
}

watch(isOpen, (open) => {
  if (open) {
    window.addEventListener('pointerdown', onDocumentClick, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
  } else {
    window.removeEventListener('pointerdown', onDocumentClick, true);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onViewportChange, true);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onDocumentClick, true);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});
</script>

<template>
  <div ref="rootRef" class="glass-dropdown" :class="[`gd-${variant}`, { 'is-open': isOpen, 'is-disabled': disabled }]">
    <button
      ref="triggerRef"
      type="button"
      class="gd-trigger"
      :disabled="disabled"
      :aria-label="ariaLabel || placeholder"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <span v-if="$slots.prefix" class="gd-prefix">
        <slot name="prefix" />
      </span>
      <span class="gd-value">{{ selectedOption ? selectedOption.label : placeholder }}</span>
      <ChevronDown :size="14" class="gd-chevron" :class="{ rotated: isOpen }" />
    </button>

    <Teleport to="body">
      <Transition name="gd-pop">
        <div
          v-if="isOpen"
          ref="menuWrapRef"
          class="gd-menu-wrap"
          :style="menuStyle"
        >
          <LiquidGlass
            tag="div"
            variant="tinted"
            :radius="20"
            :bezel-width="14"
            :blur="6"
            :saturate="1.55"
            :dispersion="true"
            :max-dim="320"
            :strength="0.52"
            class="gd-menu"
            :class="`gd-menu-${variant}`"
            role="listbox"
            :aria-label="ariaLabel || placeholder"
          >
            <div class="gd-menu-inner">
              <button
                v-for="(opt, idx) in options"
                :key="opt.value"
                type="button"
                role="option"
                class="gd-option"
                :class="{
                  selected: opt.value === modelValue,
                  highlighted: idx === activeIndex,
                }"
                :aria-selected="opt.value === modelValue"
                @mouseenter="activeIndex = idx"
                @click="selectOption(opt)"
              >
                <span class="gd-option-label">{{ opt.label }}</span>
                <Check v-if="opt.value === modelValue" :size="14" class="gd-check" />
              </button>
            </div>
          </LiquidGlass>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.glass-dropdown {
  position: relative;
  display: inline-flex;
}

.gd-field {
  width: 100%;
}

.gd-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  font-family: var(--font-sans);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition:
    transform var(--ease-spring),
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 180ms ease;
}

.gd-trigger:active:not(:disabled) {
  transform: scale(0.98);
  transition: transform var(--ease-press);
}

.gd-trigger:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

/* Header Pill Variant (inside TopConsole clear liquid glass) */
.gd-header .gd-trigger {
  min-height: 44px;
  min-width: 148px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    0 4px 12px rgba(10, 22, 42, 0.1);
}

.gd-header .gd-trigger:hover:not(:disabled),
.gd-header.is-open .gd-trigger {
  background: rgba(255, 255, 255, 0.26);
  border-color: rgba(255, 255, 255, 0.78);
}

.gd-header .gd-prefix,
.gd-header .gd-chevron {
  color: rgba(255, 255, 255, 0.85);
}

/* Field Variant (inside UploadModal / DetailDrawer edit forms) */
.gd-field .gd-trigger {
  min-height: 38px;
  padding: 0 12px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: var(--font-weight-regular);
  color: var(--ink-primary);
  background: var(--surface-input);
  border: 1px solid var(--border-mid);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
}

:root[data-theme='dark'] .gd-field .gd-trigger {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.gd-field .gd-trigger:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.68);
}

:root[data-theme='dark'] .gd-field .gd-trigger:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.13);
}

.gd-field.is-open .gd-trigger,
.gd-field .gd-trigger:focus-visible {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.gd-prefix {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.gd-value {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd-chevron {
  flex-shrink: 0;
  color: var(--ink-muted);
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.gd-chevron.rotated {
  transform: rotate(180deg);
}
</style>

<style>
/* Teleported Liquid Glass Menu (inherits LiquidGlass optical refraction + specular rim) */
.gd-menu {
  padding: 6px;
  overflow: hidden;
}

.gd-menu-inner {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 350px;
  overflow-y: auto;
}

.gd-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: var(--ink-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition:
    transform var(--ease-spring),
    background 130ms ease,
    border-color 130ms ease,
    color 130ms ease;
}

:root[data-theme='dark'] .gd-option {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.gd-option:active {
  transform: scale(0.97);
  transition: transform var(--ease-press);
}

.gd-option.highlighted,
.gd-option:hover {
  background: rgba(255, 255, 255, 0.36);
  border-color: rgba(255, 255, 255, 0.56);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

:root[data-theme='dark'] .gd-option.highlighted,
:root[data-theme='dark'] .gd-option:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.24);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.gd-option.selected {
  color: #ffffff;
  text-shadow: none;
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.88) 0%, rgba(37, 99, 235, 0.92) 100%);
  border-color: rgba(255, 255, 255, 0.48);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.52),
    0 4px 12px rgba(37, 99, 235, 0.28);
}

:root[data-theme='dark'] .gd-option.selected {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.12) 100%);
  border-color: rgba(255, 255, 255, 0.36);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    0 4px 14px rgba(0, 0, 0, 0.28);
}

.gd-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd-check {
  flex-shrink: 0;
}

.gd-pop-enter-active,
.gd-pop-leave-active {
  transition: opacity 150ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.gd-pop-enter-from,
.gd-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>
