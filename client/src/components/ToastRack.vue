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
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  color: #f6ead7;
  background: linear-gradient(180deg, #3c2e26 0%, #241b16 100%);
  border: 1px solid #6a523e;
  box-shadow:
    inset 0 1px 0 rgba(255, 236, 204, 0.22),
    0 8px 22px rgba(0, 0, 0, 0.55);
}

.toast-plaque.error {
  border-color: #b54547;
  color: #ffd6d6;
}
</style>
