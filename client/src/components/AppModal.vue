<script setup>
import { watch, onBeforeUnmount } from 'vue';
import { X } from 'lucide-vue-next';

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
        <div
          class="app-modal-panel"
          :style="{ maxWidth }"
          role="dialog"
          aria-modal="true"
          :aria-label="title || '对话框'"
        >
          <header v-if="title || $slots.header" class="app-modal-header">
            <slot name="header">
              <div class="app-modal-heading">
                <h2 class="app-modal-title">{{ title }}</h2>
                <p v-if="subtitle" class="app-modal-sub">{{ subtitle }}</p>
              </div>
            </slot>
            <button
              class="skeuo-btn app-modal-close"
              title="关闭"
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
              <button class="skeuo-btn" :disabled="loading" @click="emit('close')">
                {{ cancelText }}
              </button>
              <button
                class="skeuo-btn"
                :class="danger ? 'skeuo-btn-danger' : 'skeuo-btn-primary'"
                :disabled="loading"
                @click="emit('confirm')"
              >
                {{ loading ? '处理中…' : confirmText }}
              </button>
            </slot>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--backdrop-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 120;
}

.app-modal-panel {
  width: 100%;
  max-height: 90vh;
  padding: 20px 22px;
  border-radius: 14px;
  background: var(--surface-card);
  border: 1px solid var(--border-mid);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
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
  transition: opacity 0.16s ease;
}

.modal-fade-enter-active .app-modal-panel,
.modal-fade-leave-active .app-modal-panel {
  transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .app-modal-panel,
.modal-fade-leave-to .app-modal-panel {
  transform: translateY(8px) scale(0.98);
}
</style>
