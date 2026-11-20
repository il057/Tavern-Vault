<script setup>
import { ref } from 'vue';
import { UploadCloud, X, FileText, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import { uploadFiles, formatBytes } from '../api/vault.js';
import AppModal from './AppModal.vue';

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
    <div v-if="queuedFiles.length" class="queue-list recessed-well">
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
      <label class="field-box">
        <span>归档分类</span>
        <select v-model="category" class="recessed-well field-input">
          <option value="auto">智能自动识别（推荐）</option>
          <option value="character">角色卡 (Character Card)</option>
          <option value="preset">对话预设 (Preset)</option>
          <option value="theme">界面主题 (Theme)</option>
          <option value="worldbook">世界书 (World Info)</option>
          <option value="other">正则与扩展 (Other)</option>
        </select>
      </label>

      <label class="field-box">
        <span>归入分组（可选）</span>
        <input
          v-model="folder"
          type="text"
          placeholder="例如：古风大世界 / Claude 常用"
          class="recessed-well field-input"
        />
      </label>

      <label class="field-box full-span">
        <span>附加标签（逗号分隔，可选）</span>
        <input
          v-model="tags"
          type="text"
          placeholder="例如：V3, 长篇, 暗黑主题"
          class="recessed-well field-input"
        />
      </label>
    </div>

    <div v-if="errorMsg" class="error-bar">
      <AlertCircle :size="15" />
      <span>{{ errorMsg }}</span>
    </div>

    <template #footer>
      <button class="skeuo-btn" :disabled="uploading" @click="emit('close')">取消</button>
      <button
        class="skeuo-btn skeuo-btn-primary"
        :disabled="queuedFiles.length === 0 || uploading"
        @click="submitUpload"
      >
        <CheckCircle2 :size="15" />
        <span>{{ uploading ? '正在解析归档…' : `确认贴入 (${queuedFiles.length})` }}</span>
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
/* Blueprint Studio Drop Tray */
.drop-tray {
  padding: 28px 20px;
  border-radius: 11px;
  text-align: center;
  cursor: pointer;
  background:
    radial-gradient(rgba(59, 91, 219, 0.1) 1px, transparent 1px),
    #f6f8ff;
  background-size: 18px 18px;
  border: 2px dashed #93b4f8;
  transition: all 0.16s ease;
}

.drop-tray:hover,
.drop-tray.dragging {
  border-color: var(--accent-cobalt);
  background:
    radial-gradient(rgba(59, 91, 219, 0.14) 1px, transparent 1px),
    #edf2ff;
}

.tray-icon {
  color: var(--accent-cobalt);
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
  background: #ffffff;
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
  color: var(--accent-cobalt);
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
  background: #ffffff;
  color: var(--ink-primary);
}

.error-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #fff5f5;
  border: 1px solid #ffc9c9;
  color: #c92a2a;
  font-size: 12.5px;
}
</style>
