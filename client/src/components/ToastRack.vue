<script setup>
defineProps({
  toasts: { type: Array, default: () => [] },
});
</script>

<template>
  <div class="toast-rack">
    <div v-for="t in toasts" :key="t.id" class="toast-plaque" :class="t.type">
      <span class="led-dot" :class="t.type === 'error' ? 'led-amber' : 'led-green'"></span>
      <span>{{ t.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.toast-rack {
  position: fixed;
  right: 22px;
  bottom: 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 200;
  pointer-events: none;
}

.toast-plaque {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--toast-ink);
  background: linear-gradient(180deg, var(--toast-bg-start) 0%, var(--toast-bg-end) 100%);
  border: 1px solid var(--toast-border);
  box-shadow:
    inset 0 1px 0 var(--toast-inset),
    var(--toast-shadow);
}

.toast-plaque.error {
  border-color: var(--toast-error-border);
  color: var(--toast-error-ink);
}
</style>
