<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  Eye,
  FileText,
  Maximize2,
  Copy,
  Check,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-vue-next';
import AppModal from './AppModal.vue';
import { useTheme } from '../composables/useTheme.js';
import {
  isDefaultGreetingScript,
  hasHtmlMarkup,
  runRegexPipeline,
  formatMarkdownPreservingHtml,
  unwrapRenderableHtmlBlocks,
  buildSandboxSrcdoc,
} from '../utils/regexEngine.js';

const props = defineProps({
  greetings: { type: Array, default: () => [] },
  scripts: { type: Array, default: () => [] },
  charName: { type: String, default: 'Character' },
  itemId: { type: String, default: '' },
});

const emit = defineEmits(['notify']);

const { resolvedTheme } = useTheme();

const selectedGreeting = ref(0);
const viewMode = ref('raw'); // 'rendered' | 'raw'
const enableMarkdown = ref(true);
const enableMacros = ref(true);
const userName = ref('User');
const showSettings = ref(false);
const enabledScriptIds = ref(new Set());
const frameHeights = ref({});
const fullscreenOpen = ref(false);
const copied = ref(false);

function initDefaultScripts() {
  const next = new Set();
  for (const s of props.scripts || []) {
    if (isDefaultGreetingScript(s)) {
      next.add(s.id);
    }
  }
  enabledScriptIds.value = next;
}

const currentGreeting = computed(() => props.greetings[selectedGreeting.value] || null);

const renderedResult = computed(() => {
  const g = currentGreeting.value;
  if (!g) {
    return { html: '', rawOutput: '', matchedScripts: [] };
  }
  const pipeline = runRegexPipeline(g.text, props.scripts, {
    enabledIds: enabledScriptIds.value,
    enableMacros: enableMacros.value,
    charName: props.charName || 'Character',
    userName: userName.value || 'User',
  });

  const html = enableMarkdown.value
    ? formatMarkdownPreservingHtml(pipeline.output)
    : unwrapRenderableHtmlBlocks(pipeline.output);

  return {
    html,
    rawOutput: pipeline.output,
    matchedScripts: pipeline.matchedScripts,
  };
});

function syncDefaultViewMode() {
  const g = currentGreeting.value;
  if (!g) {
    viewMode.value = 'raw';
    return;
  }
  const hasMatchedRegex = renderedResult.value.matchedScripts.length > 0;
  const hasDirectHtml = hasHtmlMarkup(g.text);
  viewMode.value = hasMatchedRegex || hasDirectHtml ? 'rendered' : 'raw';
}

watch(
  () => [props.itemId, props.scripts],
  () => {
    selectedGreeting.value = 0;
    showSettings.value = false;
    frameHeights.value = {};
    initDefaultScripts();
    syncDefaultViewMode();
  },
  { immediate: true }
);

watch(selectedGreeting, () => {
  syncDefaultViewMode();
});

const inlineFrameId = computed(() => `greeting-${props.itemId}-${selectedGreeting.value}`);
const modalFrameId = computed(() => `greeting-modal-${props.itemId}-${selectedGreeting.value}`);

const inlineSrcdoc = computed(() =>
  buildSandboxSrcdoc(renderedResult.value.html, inlineFrameId.value, resolvedTheme.value, {
    padding: '18px 20px',
  })
);

const modalSrcdoc = computed(() =>
  buildSandboxSrcdoc(renderedResult.value.html, modalFrameId.value, resolvedTheme.value, {
    padding: '22px 26px',
  })
);

function onFrameMessage(e) {
  if (e.data && e.data.type === 'st-regex-resize' && e.data.frameId) {
    const h = Math.max(160, Math.min(2200, Number(e.data.height) || 320));
    frameHeights.value[e.data.frameId] = h;
  }
}

onMounted(() => {
  window.addEventListener('message', onFrameMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onFrameMessage);
});

function toggleScript(id) {
  const next = new Set(enabledScriptIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  enabledScriptIds.value = next;
}

function resetScripts() {
  initDefaultScripts();
}

async function copyGreeting() {
  const g = currentGreeting.value;
  if (!g) return;
  try {
    await navigator.clipboard.writeText(g.text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    emit('notify', { type: 'error', text: '复制失败，请手动选择复制' });
  }
}

const matchedIdSet = computed(() => new Set(renderedResult.value.matchedScripts.map((m) => m.id)));
</script>

<template>
  <div class="greeting-panel">
    <!-- Greeting selector pills -->
    <div v-if="greetings.length > 1" class="greeting-pills">
      <button
        v-for="(g, idx) in greetings"
        :key="idx"
        class="glass-pill-btn compact"
        :class="{ 'active-pill': selectedGreeting === idx }"
        @click="selectedGreeting = idx"
      >
        {{ g.title }}
      </button>
    </div>

    <div v-if="currentGreeting" class="parchment-block">
      <!-- Top bar -->
      <div class="greeting-header">
        <div class="greeting-title-wrap">
          <h4>{{ currentGreeting.title }}</h4>
          <span
            v-if="renderedResult.matchedScripts.length > 0"
            class="status-badge badge-sage"
            :title="`已应用 ${renderedResult.matchedScripts.length} 条正则脚本`"
          >
            <Sparkles :size="10" />
            命中 {{ renderedResult.matchedScripts.length }} 条正则
          </span>
          <span
            v-else-if="scripts.length > 0"
            class="status-badge badge-neutral"
            title="当前开场白未命中已启用的显示正则"
          >
            {{ scripts.length }} 条正则（未命中）
          </span>
        </div>

        <div class="greeting-controls">
          <div class="segmented-group mini-rocker">
            <button
              class="segmented-btn"
              :class="{ active: viewMode === 'rendered' }"
              title="应用正则与基础排版后的预览视图"
              @click="viewMode = 'rendered'"
            >
              <Eye :size="12" />
              <span>正则渲染</span>
            </button>
            <button
              class="segmented-btn"
              :class="{ active: viewMode === 'raw' }"
              title="查看未经正则处理的原始开场白文本"
              @click="viewMode = 'raw'"
            >
              <FileText :size="12" />
              <span>原始文本</span>
            </button>
          </div>

          <button
            v-if="viewMode === 'rendered'"
            class="glass-pill-btn compact mini-btn"
            :class="{ 'btn-active': showSettings }"
            title="展开正则与宏渲染选项"
            @click="showSettings = !showSettings"
          >
            <SlidersHorizontal :size="12" />
            <span>选项</span>
          </button>

          <button
            v-if="viewMode === 'rendered'"
            class="glass-pill-btn compact icon-only-btn"
            title="放大弹窗预览"
            @click="fullscreenOpen = true"
          >
            <Maximize2 :size="12" />
          </button>

          <button class="glass-pill-btn compact mini-btn" @click="copyGreeting">
            <Check v-if="copied" :size="12" />
            <Copy v-else :size="12" />
            <span>{{ copied ? '已复制' : '复制原文' }}</span>
          </button>
        </div>
      </div>

      <!-- Collapsible Render Settings & Regex Toggle -->
      <div v-if="viewMode === 'rendered' && showSettings" class="settings-drawer">
        <div class="settings-row">
          <label class="toggle-check">
            <input v-model="enableMarkdown" type="checkbox" />
            <span>基础 Markdown 排版（斜体 / 粗体 / 引号 / 换行）</span>
          </label>
          <label class="toggle-check">
            <input v-model="enableMacros" type="checkbox" />
            <span>宏替换（<code>&#123;&#123;char&#125;&#125;</code> / <code>&#123;&#123;user&#125;&#125;</code>）</span>
          </label>
          <label v-if="enableMacros" class="user-input-wrap">
            <span>User 名：</span>
            <input v-model="userName" type="text" class="mini-input" placeholder="User" />
          </label>
        </div>

        <div v-if="scripts.length > 0" class="scripts-selector">
          <div class="scripts-selector-head">
            <span>参与渲染的正则脚本（已启用 {{ enabledScriptIds.size }} / {{ scripts.length }}）</span>
            <button class="link-reset" @click="resetScripts">恢复默认</button>
          </div>
          <div class="scripts-chips">
            <label
              v-for="s in scripts"
              :key="s.id"
              class="script-chip"
              :class="{
                checked: enabledScriptIds.has(s.id),
                matched: matchedIdSet.has(s.id),
              }"
              :title="s.promptOnly ? '标记为仅提示词 (promptOnly)' : s.disabled ? '角色卡中默认禁用' : s.findRegex"
            >
              <input
                type="checkbox"
                :checked="enabledScriptIds.has(s.id)"
                @change="toggleScript(s.id)"
              />
              <span class="chip-name">{{ s.scriptName }}</span>
              <span v-if="matchedIdSet.has(s.id)" class="chip-tag hit">命中</span>
              <span v-else-if="s.promptOnly" class="chip-tag">仅提示词</span>
              <span v-else-if="s.disabled" class="chip-tag">默认禁用</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Matched Regex Summary Strip (when settings collapsed) -->
      <div
        v-if="viewMode === 'rendered' && !showSettings && renderedResult.matchedScripts.length > 0"
        class="matched-strip"
      >
        <span class="matched-label">生效正则：</span>
        <span
          v-for="m in renderedResult.matchedScripts"
          :key="m.id"
          class="matched-pill"
        >
          {{ m.scriptName }}
          <em v-if="m.matchCount > 1">×{{ m.matchCount }}</em>
        </span>
      </div>

      <!-- RENDERED VIEW -->
      <div v-if="viewMode === 'rendered'" class="iframe-shell" :class="resolvedTheme">
        <iframe
          :srcdoc="inlineSrcdoc"
          sandbox="allow-scripts"
          class="preview-frame"
          :style="{ height: `${frameHeights[inlineFrameId] || 320}px` }"
          title="开场白正则渲染预览"
        ></iframe>
      </div>

      <!-- RAW VIEW -->
      <pre v-else class="prose-pre">{{ currentGreeting.text }}</pre>
    </div>

    <!-- Fullscreen Modal -->
    <AppModal
      :open="fullscreenOpen"
      :title="currentGreeting ? `开场白预览 · ${currentGreeting.title}` : '开场白预览'"
      subtitle="独立沙盒渲染，自动跟随当前界面明暗主题"
      max-width="980px"
      @close="fullscreenOpen = false"
    >
      <template v-if="currentGreeting">
        <div class="modal-stage-bar">
          <div class="modal-tags">
            <span v-if="renderedResult.matchedScripts.length > 0" class="status-badge badge-sage">
              <Sparkles :size="10" />
              命中 {{ renderedResult.matchedScripts.length }} 条正则
            </span>
            <span class="modal-hint">
              {{ enableMacros ? `宏：${charName || 'Character'} / ${userName || 'User'}` : '未启用宏替换' }}
            </span>
          </div>
        </div>

        <div class="iframe-shell" :class="resolvedTheme">
          <iframe
            :srcdoc="modalSrcdoc"
            sandbox="allow-scripts"
            class="preview-frame modal-frame"
            :style="{ height: `${Math.max(460, frameHeights[modalFrameId] || 520)}px` }"
            title="全屏开场白正则渲染预览"
          ></iframe>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.greeting-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.greeting-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.active-pill {
  color: #ffffff !important;
  background: var(--color-focus) !important;
  border-color: #2b44b8 !important;
}

.parchment-block {
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(240, 248, 255, 0.16) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow:
    0 6px 22px rgba(15, 28, 52, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:root[data-theme='dark'] .parchment-block {
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.09) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow:
    0 6px 22px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.greeting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.greeting-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.greeting-title-wrap h4 {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-primary);
}

.greeting-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.mini-rocker .segmented-btn {
  padding: 4px 8px;
  font-size: 11.5px;
}

.mini-btn {
  padding: 4px 9px;
  font-size: 11.5px;
}

.icon-only-btn {
  padding: 5px 8px;
}

.btn-active {
  color: var(--color-focus) !important;
  background: var(--accent-sage-soft) !important;
  border-color: var(--accent-sage-border) !important;
}

.settings-drawer {
  padding: 11px 13px;
  border-radius: 8px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--ink-secondary);
}

.toggle-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.toggle-check code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-primary);
}

.user-input-wrap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.mini-input {
  width: 100px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-mid);
  background: var(--surface-input);
  color: var(--ink-primary);
  font-size: 12px;
  outline: none;
}

.mini-input:focus {
  border-color: var(--color-focus);
}

.scripts-selector {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-light);
}

.scripts-selector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-secondary);
}

.link-reset {
  border: none;
  background: transparent;
  color: var(--color-focus);
  font-size: 11.5px;
  cursor: pointer;
  padding: 0;
}

.scripts-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.script-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-light);
  background: var(--surface-solid-content);
  color: var(--ink-secondary);
  font-size: 11.5px;
  cursor: pointer;
  user-select: none;
  transition: all 0.12s ease;
}

.script-chip.checked {
  border-color: var(--accent-sage-border);
  color: var(--ink-primary);
}

.script-chip.matched {
  border-color: var(--accent-sage-border);
  background: var(--accent-sage-soft);
}

.chip-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-well);
  color: var(--ink-muted);
}

.chip-tag.hit {
  background: var(--color-focus);
  color: #fff;
}

.matched-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11.5px;
}

.matched-label {
  color: var(--ink-muted);
}

.matched-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  color: var(--ink-secondary);
}

.matched-pill em {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-focus);
}

.iframe-shell {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-mid);
  transition: background 0.15s ease;
}

.iframe-shell.dark {
  background: #141821;
  border-color: #273042;
}

.iframe-shell.light {
  background: #f8fafc;
}

.preview-frame {
  width: 100%;
  border: none;
  display: block;
  min-height: 160px;
}

.modal-frame {
  min-height: 460px;
}

.prose-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.72;
  color: var(--ink-prose);
}

.modal-stage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.modal-tags {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.modal-hint {
  font-size: 12px;
  color: var(--ink-secondary);
}
</style>
