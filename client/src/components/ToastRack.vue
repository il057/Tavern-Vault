<script setup>
import LiquidGlass from './LiquidGlass.vue';

defineProps({
  toasts: { type: Array, default: () => [] },
});
</script>

<template>
  <div class="toast-rack" aria-live="polite">
    <LiquidGlass
      v-for="t in toasts"
      :key="t.id"
      variant="tinted"
      :radius="999"
      :blur="10"
      class="toast-pill"
      :class="t.type"
    >
      <span class="toast-inner">
        <span class="status-dot" :class="t.type === 'error' ? 'amber' : 'active'"></span>
        <span class="toast-text">{{ t.text }}</span>
      </span>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.toast-rack {
  position: fixed;
  right: var(--spacing-24);
  bottom: var(--spacing-24);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-8);
  z-index: 200;
  pointer-events: none;
}

.toast-pill {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 18px;
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  color: var(--ink-primary);
  box-shadow: var(--elevation-transient);
}

.toast-inner {
  position: relative;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.toast-pill.error {
  border-color: var(--accent-danger-border);
  color: var(--accent-danger-text);
}
</style>
