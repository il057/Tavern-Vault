<script setup>
import { ref } from 'vue';
import { UploadCloud, X, FileText, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import { uploadFiles, formatBytes } from '../api/vault.js';

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
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
      <div class="upload-folio">
        <div class="folio-header">
          <div>
            <h2 class="folio-title">导入 SillyTavern 档案</h2>
            <p class="folio-sub">支持角色卡（.png / .json）、对话预设、界面主题、世界书及正则脚本</p>
          </div>
          <button class="skeuo-btn close-btn" @click="emit('close')">
            <X :size="16" />
          </button>
        </div>

        <!-- Felt-Lined Drop Tray -->
        <div
          class="felt-tray"
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
          <UploadCloud :size="38" class="tray-icon" />
          <div class="tray-title">拖拽文件至此托盘，或点击选择文件</div>
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
            <span>归入抽屉（可选）</span>
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

        <div class="folio-actions">
          <button class="skeuo-btn" @click="emit('close')">取消</button>
          <button
            class="skeuo-btn skeuo-btn-brass"
            :disabled="queuedFiles.length === 0 || uploading"
            @click="submitUpload"
          >
            <CheckCircle2 :size="15" />
            <span>{{ uploading ? '正在解析归档…' : `确认入库 (${queuedFiles.length})` }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 7, 5, 0.76);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.upload-folio {
  width: 100%;
  max-width: 600px;
  padding: 22px 24px;
  border-radius: 14px;
  background: linear-gradient(180deg, #352720 0%, #241a15 100%);
  border: 2px solid #594333;
  box-shadow:
    inset 0 1px 0 rgba(255, 236, 204, 0.2),
    0 24px 60px rgba(0, 0, 0, 0.72);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.folio-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.folio-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 19px;
  color: #f4e4c8;
}

.folio-sub {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: #b49f89;
}

.close-btn {
  padding: 6px;
}

/* Recessed Billiard-Green Felt Tray */
.felt-tray {
  padding: 28px 20px;
  border-radius: 11px;
  text-align: center;
  cursor: pointer;
  background:
    radial-gradient(circle at 50% 35%, rgba(65, 118, 86, 0.35), transparent 70%),
    linear-gradient(180deg, #16291f 0%, #101f17 100%);
  border: 2px dashed rgba(212, 169, 106, 0.45);
  box-shadow:
    inset 0 4px 14px rgba(0, 0, 0, 0.75),
    0 1px 0 rgba(255, 232, 198, 0.16);
  transition: all 0.16s ease;
}

.felt-tray:hover,
.felt-tray.dragging {
  border-color: #f0cf8e;
  background:
    radial-gradient(circle at 50% 35%, rgba(84, 152, 110, 0.45), transparent 70%),
    linear-gradient(180deg, #1b3427 0%, #13251b 100%);
}

.tray-icon {
  color: #e6c380;
  margin-bottom: 8px;
}

.tray-title {
  font-size: 14.5px;
  font-weight: 600;
  color: #f4ead9;
}

.tray-hint {
  margin-top: 5px;
  font-size: 12px;
  color: #9cb8a6;
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
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 236, 204, 0.06);
  font-size: 12.5px;
}

.q-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.q-icon {
  color: #d9ae62;
  flex-shrink: 0;
}

.q-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-size {
  font-family: var(--font-mono);
  font-size: 11px;
  color: #a69480;
  flex-shrink: 0;
}

.q-remove {
  border: none;
  background: transparent;
  color: #c9a993;
  cursor: pointer;
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
  color: #cbb79e;
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
  background: #231914;
  color: #f3e8d8;
}

.error-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgba(158, 42, 43, 0.25);
  border: 1px solid rgba(220, 82, 84, 0.55);
  color: #ffd0d0;
  font-size: 12.5px;
}

.folio-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 6px;
}
</style>
