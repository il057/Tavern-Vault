<script setup>
import { ref } from 'vue';
import { UploadCloud, X, FileText, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import { uploadFiles, formatBytes } from '../api/vault.js';
import AppModal from './AppModal.vue';
import GlassDropdown from './GlassDropdown.vue';

const categoryOptions = [
  { value: 'auto', label: '智能自动识别（推荐）' },
  { value: 'character', label: '角色卡 (Character Card)' },
  { value: 'preset', label: '对话预设 (Preset)' },
  { value: 'theme', label: '界面主题 (Theme)' },
  { value: 'worldbook', label: '世界书 (World Info)' },
  { value: 'other', label: '正则与扩展 (Other)' },
];

defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'uploaded']);

const isDragging = ref(false);
const queuedFiles = ref([]);
const category = ref('auto');
const folder = ref('');
const tags = ref('');
const uploading = ref(false);
const errorMsg = ref('');
const fileInput = ref(null);

function addFiles(fileList) {
  errorMsg.value = '';
  const incoming = Array.from(fileList || []).filter((f) => {
    const lower = f.name.toLowerCase();
    return lower.endsWith('.json') || lower.endsWith('.png');
  });
  if (incoming.length === 0) {
    errorMsg.value = '仅支持导入 .json 或 .png 格式的 SillyTavern 档案文件';
    return;
  }
  queuedFiles.value = [...queuedFiles.value, ...incoming];
}

function onDrop(e) {
  isDragging.value = false;
  addFiles(e.dataTransfer?.files);
}

function removeFile(idx) {
  queuedFiles.value.splice(idx, 1);
}

async function submitUpload() {
  if (queuedFiles.value.length === 0 || uploading.value) return;
  uploading.value = true;
  errorMsg.value = '';
  try {
    const res = await uploadFiles(queuedFiles.value, {
      category: category.value,
      folder: folder.value,
      tags: tags.value,
    });
    queuedFiles.value = [];
    folder.value = '';
    tags.value = '';
    category.value = 'auto';
    emit('uploaded', res);
    emit('close');
  } catch (err) {
    errorMsg.value = err.message || '导入失败';
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <AppModal
    :open="open"
    title="导入 SillyTavern 档案"
    subtitle="支持角色卡（.png / .json）、对话预设、界面主题、世界书及正则脚本"
    max-width="600px"
    :loading="uploading"
    @close="emit('close')"
  >
    <!-- Studio Pinboard Drop Zone -->
    <div
      class="drop-tray"
      :class="{ dragging: isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        accept=".json,.png"
        style="display: none"
        @change="addFiles($event.target.files); $event.target.value = ''"
      />
      <UploadCloud :size="36" class="tray-icon" />
      <div class="tray-title">拖拽文件至此区域，或点击选择文件</div>
      <div class="tray-hint">支持批量导入 · 单文件最大 100 MB · 自动识别角色卡 / 预设 / 主题 / 世界书</div>
    </div>

    <!-- Queued Files -->
    <div v-if="queuedFiles.length" class="queue-list solid-input-well">
      <div v-for="(f, idx) in queuedFiles" :key="`${f.name}-${idx}`" class="queue-item">
        <div class="q-left">
          <ImageIcon v-if="f.name.toLowerCase().endsWith('.png')" :size="15" class="q-icon" />
          <FileText v-else :size="15" class="q-icon" />
          <span class="q-name">{{ f.name }}</span>
          <span class="q-size">{{ formatBytes(f.size) }}</span>
        </div>
        <button class="q-remove" @click="removeFile(idx)">
          <X :size="13" />
        </button>
      </div>
    </div>

    <!-- Metadata Options -->
    <div class="options-grid">
      <div class="field-box">
        <span>归档分类</span>
        <GlassDropdown
          v-model="category"
          :options="categoryOptions"
          variant="field"
          aria-label="归档分类"
        />
      </div>

      <label class="field-box">
        <span>归入分组（可选）</span>
        <input
          v-model="folder"
          type="text"
          placeholder="例如：古风大世界 / Claude 常用"
          class="solid-input-well field-input"
        />
      </label>

      <label class="field-box full-span">
        <span>附加标签（逗号分隔，可选）</span>
        <input
          v-model="tags"
          type="text"
          placeholder="例如：V3, 长篇, 暗黑主题"
          class="solid-input-well field-input"
        />
      </label>
    </div>

    <div v-if="errorMsg" class="error-bar">
      <AlertCircle :size="15" />
      <span>{{ errorMsg }}</span>
    </div>

    <template #footer>
      <button class="glass-pill-btn" :disabled="uploading" @click="emit('close')">取消</button>
      <button
        class="glass-pill-btn glass-btn-primary"
        :disabled="queuedFiles.length === 0 || uploading"
        @click="submitUpload"
      >
        <CheckCircle2 :size="15" />
        <span>{{ uploading ? '正在解析归档…' : `确认导入 (${queuedFiles.length})` }}</span>
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
/* Clean Liquid Glass Drop Tray */
.drop-tray {
  padding: 28px 20px;
  border-radius: 20px;
  text-align: center;
  cursor: pointer;
  background: var(--surface-well);
  border: 1.5px dashed var(--accent-sage-border);
  transition: border-color 160ms ease, background-color 160ms ease;
}

.drop-tray:hover,
.drop-tray.dragging {
  border-color: var(--color-focus);
  background: var(--accent-sage-soft);
}

.tray-icon {
  color: var(--color-focus);
  margin-bottom: 8px;
}

.tray-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ink-primary);
}

.tray-hint {
  margin-top: 5px;
  font-size: 12px;
  color: var(--ink-secondary);
}

.queue-list {
  max-height: 150px;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 9px;
  border-radius: 7px;
  background: var(--surface-solid-content);
  border: 1px solid var(--border-light);
  font-size: 12.5px;
}

.q-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.q-icon {
  color: var(--color-focus);
  flex-shrink: 0;
}

.q-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-primary);
}

.q-size {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-muted);
  flex-shrink: 0;
}

.q-remove {
  border: none;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}

.q-remove:hover {
  color: var(--accent-danger);
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.field-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-secondary);
}

.full-span {
  grid-column: 1 / -1;
}

.field-input {
  width: 100%;
  height: 38px;
  padding: 0 11px;
  font-size: 13px;
  outline: none;
}

.field-input option {
  background: var(--surface-solid-content);
  color: var(--ink-primary);
}

.error-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--accent-danger-soft);
  border: 1px solid var(--accent-danger-border);
  color: var(--accent-danger-text);
  font-size: 12.5px;
}
</style>
