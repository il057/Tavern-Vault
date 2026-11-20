<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  Eye,
  Code2,
  Maximize2,
  Sun,
  Moon,
  Copy,
  Check,
  Sparkles,
  FlaskConical,
  ChevronDown,
  ChevronRight,
} from 'lucide-vue-next';
import AppModal from './AppModal.vue';

const props = defineProps({
  scripts: { type: Array, default: () => [] },
  sampleTexts: { type: Array, default: () => [] },
});

const expandedId = ref(null);
const viewModes = ref({}); // { [id]: 'preview' | 'code' | 'test' }
const stageTheme = ref('dark'); // 'dark' | 'light'
const customInputs = ref({});
const frameHeights = ref({});
const copiedKey = ref('');
const fullscreenScript = ref(null);

// Auto-expand the first visual regex script if available
onMounted(() => {
  window.addEventListener('message', onFrameMessage);
  if (props.scripts.length > 0) {
    const firstVisual = props.scripts.find((s) => isVisualReplace(s.replaceString));
    expandedId.value = (firstVisual || props.scripts[0]).id;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('message', onFrameMessage);
});

function onFrameMessage(e) {
  if (e.data && e.data.type === 'st-regex-resize' && e.data.frameId) {
    const h = Math.max(120, Math.min(900, Number(e.data.height) || 240));
    frameHeights.value[e.data.frameId] = h;
  }
}

function isVisualReplace(str) {
  if (!str || typeof str !== 'string') return false;
  return /<(style|div|section|article|table|span|header|main|details|svg|html|body|link|p|h[1-6]|ul|ol)\b/i.test(str);
}

function classifyScript(script) {
  const rep = (script.replaceString || '').trim();
  if (!rep) return { type: 'strip', label: '隐藏/清除规则', badgeClass: 'stamp-ink' };
  if (isVisualReplace(rep)) return { type: 'html', label: 'HTML 样式渲染', badgeClass: 'stamp-cobalt' };
  return { type: 'text', label: '文本替换', badgeClass: 'stamp-mint' };
}

function parseRegexString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // Match /pattern/flags
  const m = trimmed.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
  try {
    if (m) {
      return new RegExp(m[1], m[2] || 'g');
    }
    return new RegExp(trimmed, 'g');
  } catch {
    return null;
  }
}

/**
 * Extract readable hint labels before each capturing group in findRegex
 * so mock previews display meaningful field names instead of raw "$1", "$2".
 */
function extractGroupHints(findRegex) {
  if (!findRegex) return [];
  const hints = [];
  const pattern = findRegex.replace(/^\/|\/[a-z]*$/gi, '');
  const groupRegex = /([^()\\]{0,24})\((?!\?[:=!])/g;
  let match;
  let idx = 1;
  while ((match = groupRegex.exec(pattern)) !== null && idx <= 40) {
    const rawBefore = match[1] || '';
    const cleaned = rawBefore
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\\[a-zA-Z]/g, ' ')
      .replace(/[*+?^$|{}<>/:;'"`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const lastToken = cleaned.split(' ').filter(Boolean).pop() || '';
    hints.push(lastToken && lastToken.length <= 14 ? `${lastToken}示例` : `示例内容 #${idx}`);
    idx++;
  }
  return hints;
}

function buildRenderedHtml(script) {
  const replaceStr = script.replaceString || '';
  const regex = parseRegexString(script.findRegex);
  const customText = customInputs.value[script.id];

  // 1. If user entered custom test text, run real regex replacement on it
  if (typeof customText === 'string' && customText.trim()) {
    if (regex) {
      const matched = regex.test(customText);
      regex.lastIndex = 0;
      if (matched) {
        const out = customText.replace(regex, replaceStr);
        return { html: out, source: 'custom-match', matched: true };
      }
      return { html: '', source: 'custom-miss', matched: false };
    }
  }

  // 2. Try matching against actual character card greetings / examples!
  if (regex && props.sampleTexts && props.sampleTexts.length > 0) {
    for (const sample of props.sampleTexts) {
      if (!sample || typeof sample !== 'string') continue;
      regex.lastIndex = 0;
      const m = sample.match(regex);
      if (m && m.length > 0) {
        // Extract only the matched block(s) and transform them so the preview focuses on the regex UI
        regex.lastIndex = 0;
        const transformedParts = [];
        let execMatch;
        const execRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
        let guard = 0;
        while ((execMatch = execRegex.exec(sample)) !== null && guard < 3) {
          guard++;
          const singleRegex = new RegExp(regex.source, regex.flags.replace('g', ''));
          transformedParts.push(execMatch[0].replace(singleRegex, replaceStr));
          if (execMatch[0].length === 0) break;
        }
        if (transformedParts.length > 0) {
          return { html: transformedParts.join('\n'), source: 'card-match', matched: true };
        }
      }
    }
  }

  // 3. Fallback: Smart mock-fill $1..$N placeholders directly into replaceString
  const hints = extractGroupHints(script.findRegex);
  const mockFilled = replaceStr
    .replace(/\{\{match\}\}/gi, '示例匹配文本')
    .replace(/\$&/g, '示例匹配文本')
    .replace(/\$(\d{1,2})/g, (_, numStr) => {
      const idx = Number(numStr) - 1;
      return hints[idx] || `示例数据 ${numStr}`;
    });

  return { html: mockFilled, source: 'mock', matched: false };
}

function buildSrcdoc(html, frameId, theme) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#141821' : '#f8fafc';
  const fg = isDark ? '#e6edf7' : '#1e293b';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${bg};
    color: ${fg};
    font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.6;
    overflow-x: auto;
  }
  #st-preview-root {
    padding: 16px;
    min-height: 80px;
  }
  img { max-width: 100%; height: auto; }
</style>
</head>
<body>
  <div id="st-preview-root">${html}</div>
  <script>
    (function() {
      var frameId = ${JSON.stringify(frameId)};
      function report() {
        var root = document.getElementById('st-preview-root');
        var h = Math.max(
          root ? root.scrollHeight : 0,
          document.body ? document.body.scrollHeight : 0
        );
        parent.postMessage({ type: 'st-regex-resize', frameId: frameId, height: h + 8 }, '*');
      }
      window.addEventListener('load', function() { report(); setTimeout(report, 180); });
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(report).observe(document.body);
      }
      setTimeout(report, 60);
    })();
  <\/script>
</body>
</html>`;
}

function getMode(id) {
  return viewModes.value[id] || 'preview';
}

function setMode(id, mode) {
  viewModes.value[id] = mode;
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id;
}

async function copyText(text, key) {
  try {
    await navigator.clipboard.writeText(text || '');
    copiedKey.value = key;
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = '';
    }, 1500);
  } catch {
    // ignore
  }
}

const renderedMap = computed(() => {
  const map = {};
  for (const s of props.scripts) {
    map[s.id] = buildRenderedHtml(s);
  }
  return map;
});
</script>

<template>
  <div class="regex-panel">
    <div class="regex-topbar">
      <div class="regex-summary">
        <strong>正则脚本 ({{ scripts.length }})</strong>
        <span class="regex-hint">支持 HTML/CSS 前端样式实时沙盒预览</span>
      </div>

      <div class="rocker-group" title="切换预览画布明暗背景">
        <button
          class="rocker-btn"
          :class="{ active: stageTheme === 'dark' }"
          @click="stageTheme = 'dark'"
        >
          <Moon :size="13" />
          <span>暗色舞台</span>
        </button>
        <button
          class="rocker-btn"
          :class="{ active: stageTheme === 'light' }"
          @click="stageTheme = 'light'"
        >
          <Sun :size="13" />
          <span>亮色舞台</span>
        </button>
      </div>
    </div>

    <div class="regex-list">
      <div v-for="r in scripts" :key="r.id" class="regex-card">
        <div class="regex-head" @click="toggleExpand(r.id)">
          <div class="regex-head-left">
            <component :is="expandedId === r.id ? ChevronDown : ChevronRight" :size="15" class="chevron" />
            <span class="led-dot" :class="r.disabled ? 'led-off' : 'led-green'"></span>
            <strong class="regex-name">{{ r.scriptName }}</strong>
            <span class="stamp-badge" :class="classifyScript(r).badgeClass">
              {{ classifyScript(r).label }}
            </span>
            <span
              v-if="renderedMap[r.id]?.source === 'card-match' && classifyScript(r).type === 'html'"
              class="stamp-badge stamp-mint"
              title="已自动匹配当前角色卡开场白中的真实文本进行渲染"
            >
              <Sparkles :size="10" />
              实卡数据匹配
            </span>
          </div>

          <div v-if="expandedId === r.id" class="regex-head-actions" @click.stop>
            <div class="rocker-group mini-rocker">
              <button
                class="rocker-btn"
                :class="{ active: getMode(r.id) === 'preview' }"
                @click="setMode(r.id, 'preview')"
              >
                <Eye :size="12" />
                <span>样式预览</span>
              </button>
              <button
                class="rocker-btn"
                :class="{ active: getMode(r.id) === 'test' }"
                @click="setMode(r.id, 'test')"
              >
                <FlaskConical :size="12" />
                <span>实测</span>
              </button>
              <button
                class="rocker-btn"
                :class="{ active: getMode(r.id) === 'code' }"
                @click="setMode(r.id, 'code')"
              >
                <Code2 :size="12" />
                <span>源码</span>
              </button>
            </div>

            <button
              v-if="classifyScript(r).type === 'html'"
              class="skeuo-btn skeuo-btn-paper icon-only-btn"
              title="放大弹窗预览"
              @click="fullscreenScript = r"
            >
              <Maximize2 :size="13" />
            </button>
          </div>
        </div>

        <!-- Collapsed concise preview line -->
        <div v-if="expandedId !== r.id" class="regex-collapsed-find" @click="toggleExpand(r.id)">
          <code>{{ r.findRegex || '(空正则)' }}</code>
        </div>

        <!-- Expanded Body -->
        <div v-else class="regex-body">
          <!-- MODE: TEST INPUT -->
          <div v-if="getMode(r.id) === 'test'" class="test-box">
            <label class="test-label">
              <span>输入测试文本（将实时应用当前 Find Regex 并渲染 Replace 样式）</span>
              <button
                v-if="customInputs[r.id]"
                class="link-clear"
                @click="customInputs[r.id] = ''"
              >
                清空测试文本
              </button>
            </label>
            <textarea
              v-model="customInputs[r.id]"
              rows="4"
              class="test-textarea"
              placeholder="粘贴一段 AI 输出文本（例如 <事件>...</事件>），下方将实时渲染替换结果…"
            ></textarea>
            <div v-if="renderedMap[r.id]?.source === 'custom-miss'" class="miss-tip">
              当前测试文本未命中 Find Regex，请检查标签或格式是否符合：<code>{{ r.findRegex }}</code>
            </div>
          </div>

          <!-- MODE: PREVIEW OR TEST OUTPUT -->
          <div v-if="getMode(r.id) === 'preview' || getMode(r.id) === 'test'" class="preview-wrap">
            <template v-if="classifyScript(r).type === 'strip'">
              <div class="plain-result">
                该正则的 <code>replaceString</code> 为空，用于在界面中<strong>隐藏 / 移除</strong>匹配到的标签或文本块。
              </div>
            </template>

            <template v-else-if="classifyScript(r).type === 'html'">
              <div class="stage-meta">
                <span v-if="renderedMap[r.id]?.source === 'custom-match'" class="meta-pill ok">
                  已命中自定义测试文本
                </span>
                <span v-else-if="renderedMap[r.id]?.source === 'card-match'" class="meta-pill ok">
                  已从角色卡开场白中提取真实内容渲染
                </span>
                <span v-else class="meta-pill">
                  占位符自动模拟填充预览（可在「实测」中粘贴真实文本）
                </span>
              </div>

              <div class="iframe-shell" :class="stageTheme">
                <iframe
                  :srcdoc="buildSrcdoc(renderedMap[r.id]?.html || '', `inline-${r.id}`, stageTheme)"
                  sandbox="allow-scripts"
                  class="preview-frame"
                  :style="{ height: `${frameHeights[`inline-${r.id}`] || 240}px` }"
                  title="正则样式预览"
                ></iframe>
              </div>
            </template>

            <template v-else>
              <div class="plain-result">
                <div class="plain-label">替换结果预览：</div>
                <pre class="plain-pre">{{ renderedMap[r.id]?.html }}</pre>
              </div>
            </template>
          </div>

          <!-- MODE: CODE -->
          <div v-else class="code-stack">
            <div class="code-section">
              <div class="code-bar">
                <span>Find Regex</span>
                <button class="skeuo-btn skeuo-btn-paper mini-copy" @click="copyText(r.findRegex, `find-${r.id}`)">
                  <Check v-if="copiedKey === `find-${r.id}`" :size="12" />
                  <Copy v-else :size="12" />
                  <span>{{ copiedKey === `find-${r.id}` ? '已复制' : '复制' }}</span>
                </button>
              </div>
              <pre class="regex-code-box">{{ r.findRegex || '(空)' }}</pre>
            </div>

            <div class="code-section">
              <div class="code-bar">
                <span>Replace String ({{ (r.replaceString || '').length }} 字符)</span>
                <button class="skeuo-btn skeuo-btn-paper mini-copy" @click="copyText(r.replaceString, `rep-${r.id}`)">
                  <Check v-if="copiedKey === `rep-${r.id}`" :size="12" />
                  <Copy v-else :size="12" />
                  <span>{{ copiedKey === `rep-${r.id}` ? '已复制' : '复制' }}</span>
                </button>
              </div>
              <pre class="regex-code-box tall">{{ r.replaceString || '(空)' }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reusable Modal for Fullscreen Regex Style Preview -->
    <AppModal
      :open="Boolean(fullscreenScript)"
      :title="fullscreenScript ? `正则样式预览 · ${fullscreenScript.scriptName}` : ''"
      subtitle="独立沙盒渲染，支持切换亮暗背景以适配不同酒馆主题"
      max-width="960px"
      @close="fullscreenScript = null"
    >
      <template v-if="fullscreenScript">
        <div class="modal-stage-bar">
          <span class="modal-hint">
            {{
              renderedMap[fullscreenScript.id]?.source === 'card-match'
                ? '当前展示：角色卡开场白真实匹配渲染'
                : renderedMap[fullscreenScript.id]?.source === 'custom-match'
                  ? '当前展示：自定义测试文本渲染'
                  : '当前展示：占位符自动模拟填充渲染'
            }}
          </span>
          <div class="rocker-group">
            <button
              class="rocker-btn"
              :class="{ active: stageTheme === 'dark' }"
              @click="stageTheme = 'dark'"
            >
              <Moon :size="13" />
              <span>暗色舞台</span>
            </button>
            <button
              class="rocker-btn"
              :class="{ active: stageTheme === 'light' }"
              @click="stageTheme = 'light'"
            >
              <Sun :size="13" />
              <span>亮色舞台</span>
            </button>
          </div>
        </div>

        <div class="iframe-shell" :class="stageTheme">
          <iframe
            :srcdoc="buildSrcdoc(renderedMap[fullscreenScript.id]?.html || '', `modal-${fullscreenScript.id}`, stageTheme)"
            sandbox="allow-scripts"
            class="preview-frame modal-frame"
            :style="{ height: `${Math.max(420, frameHeights[`modal-${fullscreenScript.id}`] || 480)}px` }"
            title="全屏正则样式预览"
          ></iframe>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.regex-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.regex-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.regex-summary {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.regex-summary strong {
  font-size: 14px;
  color: var(--ink-primary);
}

.regex-hint {
  font-size: 12px;
  color: var(--ink-muted);
}

.regex-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.regex-card {
  border-radius: 10px;
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.regex-head {
  padding: 11px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  flex-wrap: wrap;
  background: var(--surface-subtle);
  border-bottom: 1px solid var(--border-light);
}

.regex-head:hover {
  background: var(--surface-hover);
}

.regex-head-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chevron {
  color: var(--ink-muted);
}

.regex-name {
  font-size: 13.5px;
  color: var(--ink-primary);
}

.regex-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-rocker .rocker-btn {
  padding: 4px 8px;
  font-size: 11.5px;
}

.icon-only-btn {
  padding: 6px 8px;
}

.regex-collapsed-find {
  padding: 8px 14px 10px;
  font-size: 11.5px;
  color: var(--ink-muted);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.regex-collapsed-find code {
  font-family: var(--font-mono);
}

.regex-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface-card);
}

.stage-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.meta-pill {
  font-size: 11.5px;
  color: var(--ink-muted);
}

.meta-pill.ok {
  color: var(--accent-mint-text);
  font-weight: 600;
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
  min-height: 120px;
}

.modal-frame {
  min-height: 420px;
}

.plain-result {
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  font-size: 12.5px;
  color: var(--ink-secondary);
}

.plain-label {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--ink-primary);
}

.plain-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 12px;
}

.test-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.test-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-secondary);
}

.link-clear {
  border: none;
  background: transparent;
  color: var(--accent-cobalt);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.test-textarea {
  width: 100%;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid var(--border-mid);
  background: var(--surface-well);
  color: var(--ink-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  resize: vertical;
  outline: none;
}

.test-textarea:focus {
  background: var(--surface-input);
  border-color: var(--accent-cobalt);
  box-shadow: 0 0 0 3px var(--accent-cobalt-ring);
}

.miss-tip {
  font-size: 12px;
  color: var(--accent-danger-text);
  background: var(--accent-danger-soft);
  border: 1px solid var(--accent-danger-border);
  padding: 7px 10px;
  border-radius: 7px;
  word-break: break-all;
}

.code-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.code-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.code-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-secondary);
}

.mini-copy {
  padding: 3px 9px;
  font-size: 11.5px;
}

.regex-code-box {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #141a24;
  color: #e2e8f0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow: auto;
}

.regex-code-box.tall {
  max-height: 320px;
  white-space: pre-wrap;
}

.modal-stage-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.modal-hint {
  font-size: 12.5px;
  color: var(--ink-secondary);
}
</style>
