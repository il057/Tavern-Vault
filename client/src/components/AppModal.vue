<script setup>
import { watch, onBeforeUnmount } from 'vue';
import { X } from 'lucide-vue-next';
import LiquidGlass from './LiquidGlass.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  maxWidth: { type: String, default: '520px' },
  closeOnBackdrop: { type: Boolean, default: true },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'confirm']);

function onKeydown(e) {
  if (e.key === 'Escape' && props.open && !props.loading) {
    emit('close');
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="app-modal-backdrop"
        @click.self="closeOnBackdrop && !loading ? emit('close') : null"
      >
        <LiquidGlass
          tag="div"
          variant="sheet"
          :radius="28"
          :bezel-width="20"
          :blur="8"
          :saturate="1.5"
          :refraction="false"
          :dispersion="false"
          :static-glint="true"
          class="app-modal-panel"
          :style="{ maxWidth }"
          role="dialog"
          aria-modal="true"
          :aria-label="title || '对话框'"
        >
          <div class="app-modal-content">
            <header v-if="title || $slots.header" class="app-modal-header">
              <slot name="header">
                <div class="app-modal-heading">
                  <h2 class="app-modal-title">{{ title }}</h2>
                  <p v-if="subtitle" class="app-modal-sub">{{ subtitle }}</p>
                </div>
              </slot>
              <button
                class="glass-pill-btn compact app-modal-close"
                title="关闭"
                aria-label="关闭"
                :disabled="loading"
                @click="emit('close')"
              >
                <X :size="16" />
              </button>
            </header>

            <div class="app-modal-body">
              <slot />
            </div>

            <footer v-if="$slots.footer || confirmText" class="app-modal-footer">
              <slot name="footer">
                <button class="glass-pill-btn" :disabled="loading" @click="emit('close')">
                  {{ cancelText }}
                </button>
                <button
                  class="glass-pill-btn"
                  :class="danger ? 'glass-btn-danger' : 'glass-btn-primary'"
                  :disabled="loading"
                  @click="emit('confirm')"
                >
                  {{ loading ? '处理中…' : confirmText }}
                </button>
              </slot>
            </footer>
          </div>
        </LiquidGlass>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--backdrop-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 120;
}

.app-modal-panel {
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-modal-content {
  position: relative;
  z-index: 4;
  padding: var(--spacing-24);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-16);
  max-height: 90vh;
  min-height: 0;
}

.app-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.app-modal-heading {
  min-width: 0;
}

.app-modal-title {
  margin: 0;
  font-size: 17.5px;
  font-weight: 700;
  color: var(--ink-primary);
}

.app-modal-sub {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--ink-secondary);
}

.app-modal-close {
  padding: 6px;
  flex-shrink: 0;
}

.app-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--ink-secondary);
  font-size: 13.5px;
  line-height: 1.65;
}

.app-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
  flex-shrink: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-active .app-modal-panel,
.modal-fade-leave-active .app-modal-panel {
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .app-modal-panel,
.modal-fade-leave-to .app-modal-panel {
  transform: translateY(10px) scale(0.97);
}
</style>
