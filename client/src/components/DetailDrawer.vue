<script setup>
import { ref, watch, computed } from 'vue';
import {
  X,
  Star,
  Download,
  FileJson,
  Image as ImageIcon,
  Trash2,
  Copy,
  Check,
  Search,
  Upload,
  Save,
} from 'lucide-vue-next';
import {
  fetchItemDetail,
  fetchItemRaw,
  updateItem,
  uploadCover,
  deleteItem,
  getDownloadUrl,
  getExportJsonUrl,
  getExportPngUrl,
  formatBytes,
} from '../api/vault.js';

const props = defineProps({
  itemId: { type: String, default: null },
});

const emit = defineEmits(['close', 'updated', 'deleted', 'notify']);

const loading = ref(false);
const item = ref(null);
const detail = ref(null);
const activeTab = ref('overview');

// Sub-filters
const wbSearch = ref('');
const promptSearch = ref('');
const promptFilter = ref('all'); // 'all' | 'enabled' | 'disabled'
const promptLimit = ref(60);
const expandedKey = ref(null);
const selectedGreeting = ref(0);
const cssSearch = ref('');

// Raw JSON lazy load
const rawLoading = ref(false);
const rawText = ref('');
const rawTruncated = ref(false);
const copiedKey = ref('');

// Edit form
const editForm = ref({
  name: '',
  creator: '',
  version: '',
  category: 'character',
  folder: '',
  tagsText: '',
  notes: '',
});
const savingEdit = ref(false);
const coverInput = ref(null);

watch(
  () => props.itemId,
  async (id) => {
    if (!id) {
      item.value = null;
      detail.value = null;
      return;
    }
    loading.value = true;
    activeTab.value = 'overview';
    rawText.value = '';
    rawTruncated.value = false;
    wbSearch.value = '';
    promptSearch.value = '';
    promptFilter.value = 'all';
    promptLimit.value = 60;
    expandedKey.value = null;
    selectedGreeting.value = 0;

    try {
      const res = await fetchItemDetail(id);
      item.value = res.item;
      detail.value = res.detail;
      syncEditForm(res.item);
    } catch (err) {
      emit('notify', { type: 'error', text: err.message || '加载档案详情失败' });
      emit('close');
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

function syncEditForm(it) {
  editForm.value = {
    name: it.name || '',
    creator: it.creator || '',
    version: it.version || '',
    category: it.category || 'other',
    folder: it.folder || '',
    tagsText: (it.tags || []).join(', '),
    notes: it.notes || '',
  };
}

const tabs = computed(() => {
  if (!item.value) return [];
  const c = item.value.category;
  if (c === 'character') {
    const list = [{ key: 'overview', label: '角色设定' }];
    const gCount = (detail.value?.alternate_greetings?.length || 0) + (detail.value?.first_mes ? 1 : 0);
    if (gCount > 0) list.push({ key: 'greetings', label: `开场白 (${gCount})` });
    const wbCount = detail.value?.character_book?.entries?.length || 0;
    if (wbCount > 0) list.push({ key: 'worldbook', label: `世界书 (${wbCount})` });
    if (detail.value?.regex_scripts?.length || detail.value?.extension_keys?.length) {
      list.push({ key: 'extensions', label: '扩展与正则' });
    }
    list.push({ key: 'edit', label: '档案编辑' });
    list.push({ key: 'raw', label: '原始 JSON' });
    return list;
  }
  if (c === 'preset') {
    const pCount = detail.value?.prompts?.length || 0;
    return [
      { key: 'overview', label: '采样参数' },
      { key: 'prompts', label: `提示词模块 (${pCount})` },
      { key: 'edit', label: '档案编辑' },
      { key: 'raw', label: '原始 JSON' },
    ];
  }
  if (c === 'theme') {
    return [
      { key: 'overview', label: '视觉与色板' },
      { key: 'css', label: 'Custom CSS' },
      { key: 'edit', label: '档案编辑' },
      { key: 'raw', label: '原始 JSON' },
    ];
  }
  if (c === 'worldbook') {
    const count = detail.value?.entries?.length || 0;
    return [
      { key: 'overview', label: `词条目录 (${count})` },
      { key: 'edit', label: '档案编辑' },
      { key: 'raw', label: '原始 JSON' },
    ];
  }
  return [
    { key: 'overview', label: '档案概览' },
    { key: 'edit', label: '档案编辑' },
    { key: 'raw', label: '原始 JSON' },
  ];
});

const allGreetings = computed(() => {
  if (!detail.value) return [];
  const arr = [];
  if (detail.value.first_mes) arr.push({ title: '默认开场白 (#1)', text: detail.value.first_mes });
  (detail.value.alternate_greetings || []).forEach((g, idx) => {
    const titleMatch = g.match(/<!--\s*title:\s*([^>]+?)-->/i);
    arr.push({
      title: titleMatch ? `#${idx + 2} ${titleMatch[1].trim()}` : `备选开场白 #${idx + 2}`,
      text: g,
    });
  });
  return arr;
});

const filteredWbEntries = computed(() => {
  const entries =
    item.value?.category === 'character'
      ? detail.value?.character_book?.entries || []
      : detail.value?.entries || [];
  const kw = wbSearch.value.trim().toLowerCase();
  if (!kw) return entries;
  return entries.filter(
    (e) =>
      (e.comment || '').toLowerCase().includes(kw) ||
      (e.keys || []).some((k) => String(k).toLowerCase().includes(kw)) ||
      (e.content || '').toLowerCase().includes(kw)
  );
});

const filteredPrompts = computed(() => {
  const prompts = detail.value?.prompts || [];
  const kw = promptSearch.value.trim().toLowerCase();
  return prompts.filter((p) => {
    if (promptFilter.value === 'enabled' && !p.enabled) return false;
    if (promptFilter.value === 'disabled' && p.enabled) return false;
    if (!kw) return true;
    return (
      (p.name || '').toLowerCase().includes(kw) ||
      (p.identifier || '').toLowerCase().includes(kw) ||
      (p.content || '').toLowerCase().includes(kw)
    );
  });
});

async function switchTab(key) {
  activeTab.value = key;
  if (key === 'raw' && !rawText.value && item.value) {
    rawLoading.value = true;
    try {
      const res = await fetchItemRaw(item.value.id);
      const full = JSON.stringify(res.raw, null, 2);
      if (full.length > 150000) {
        rawText.value = full.slice(0, 150000);
        rawTruncated.value = true;
      } else {
        rawText.value = full;
        rawTruncated.value = false;
      }
    } catch (err) {
      rawText.value = `读取失败: ${err.message}`;
    } finally {
      rawLoading.value = false;
    }
  }
}

async function copyText(text, key) {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = '';
    }, 1600);
  } catch {
    emit('notify', { type: 'error', text: '复制失败，请手动选择复制' });
  }
}

async function toggleFav() {
  if (!item.value) return;
  try {
    const res = await updateItem(item.value.id, { favorite: !item.value.favorite });
    item.value = res.item;
    emit('updated', res.item);
  } catch (err) {
    emit('notify', { type: 'error', text: err.message });
  }
}

async function saveEdit() {
  if (!item.value || savingEdit.value) return;
  savingEdit.value = true;
  try {
    const tags = editForm.value.tagsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await updateItem(item.value.id, {
      name: editForm.value.name,
      creator: editForm.value.creator,
      version: editForm.value.version,
      category: editForm.value.category,
      folder: editForm.value.folder,
      notes: editForm.value.notes,
      tags,
    });
    item.value = res.item;
    syncEditForm(res.item);
    emit('updated', res.item);
    emit('notify', { type: 'success', text: '档案元数据已保存' });
  } catch (err) {
    emit('notify', { type: 'error', text: err.message });
  } finally {
    savingEdit.value = false;
  }
}

async function onCoverSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !item.value) return;
  try {
    const res = await uploadCover(item.value.id, file);
    item.value = res.item;
    emit('updated', res.item);
    emit('notify', { type: 'success', text: '封面图已更新' });
  } catch (err) {
    emit('notify', { type: 'error', text: err.message });
  }
}

async function handleDelete() {
  if (!item.value) return;
  if (!window.confirm(`确定要从本地仓库永久删除「${item.value.name}」吗？此操作不可恢复。`)) return;
  try {
    await deleteItem(item.value.id);
    emit('deleted', item.value.id);
    emit('close');
  } catch (err) {
    emit('notify', { type: 'error', text: err.message });
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="itemId" class="drawer-backdrop" @click.self="emit('close')">
      <section class="folio-drawer">
        <div v-if="loading" class="drawer-loading">正在启封档案卷宗…</div>

        <template v-else-if="item">
          <!-- Leather Folio Header -->
          <header class="drawer-header">
            <div class="dh-left">
              <div class="dh-badges">
                <span class="stamp-badge" :class="item.format === 'png' ? 'stamp-wax' : 'stamp-brass'">
                  {{ item.format.toUpperCase() }}
                </span>
                <span v-if="detail?.spec" class="stamp-badge stamp-brass">{{ detail.spec }}</span>
                <span class="dh-size">{{ formatBytes(item.file_size) }}</span>
              </div>
              <h2 class="dh-title">{{ item.name }}</h2>
              <div class="dh-sub">
                <span>原文件：{{ item.original_filename }}</span>
                <span v-if="item.creator"> · 作者：{{ item.creator }}</span>
                <span v-if="item.version"> · 版本：{{ item.version }}</span>
              </div>
            </div>

            <div class="dh-actions">
              <button class="skeuo-btn" :class="{ 'fav-on': item.favorite }" title="收藏" @click="toggleFav">
                <Star :size="15" :fill="item.favorite ? '#fbbf24' : 'none'" :color="item.favorite ? '#fbbf24' : 'currentColor'" />
              </button>
              <a :href="getDownloadUrl(item.id)" class="skeuo-btn skeuo-btn-brass">
                <Download :size="14" />
                <span>下载原件</span>
              </a>
              <a
                v-if="item.category === 'character' && item.format === 'png'"
                :href="getExportJsonUrl(item.id)"
                class="skeuo-btn"
                title="提取并导出为 JSON 角色卡"
              >
                <FileJson :size="14" />
                <span>导出 JSON</span>
              </a>
              <a
                v-if="item.category === 'character' && item.format === 'json' && item.has_cover"
                :href="getExportPngUrl(item.id)"
                class="skeuo-btn"
                title="将 JSON 嵌入 PNG 封面并导出为角色卡"
              >
                <ImageIcon :size="14" />
                <span>导出 PNG</span>
              </a>
              <button class="skeuo-btn skeuo-btn-danger" title="删除档案" @click="handleDelete">
                <Trash2 :size="14" />
              </button>
              <button class="skeuo-btn" title="关闭" @click="emit('close')">
                <X :size="16" />
              </button>
            </div>
          </header>

          <!-- Physical Tab Dividers -->
          <div class="folio-tabs">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="folio-tab"
              :class="{ active: activeTab === t.key }"
              @click="switchTab(t.key)"
            >
              {{ t.label }}
            </button>
          </div>

          <!-- Parchment Folio Body -->
          <div class="folio-body">
            <!-- CHARACTER: OVERVIEW -->
            <div v-if="item.category === 'character' && activeTab === 'overview'" class="parchment-stack">
              <div class="char-hero">
                <div class="hero-cover" @click="coverInput?.click()" title="点击上传或更换封面图">
                  <img v-if="item.cover_url" :src="item.cover_url" :alt="item.name" />
                  <div v-else class="cover-empty">
                    <Upload :size="24" />
                    <span>上传封面图 (PNG/JPG)</span>
                  </div>
                  <div class="cover-overlay">更换封面</div>
                  <input ref="coverInput" type="file" accept=".png,.jpg,.jpeg,.webp" style="display: none" @change="onCoverSelected" />
                </div>

                <div class="hero-info">
                  <div v-if="item.tags?.length" class="tag-strip">
                    <span v-for="t in item.tags" :key="t" class="stamp-badge stamp-ink">{{ t }}</span>
                  </div>
                  <div v-if="item.notes" class="note-callout">
                    <strong>个人归档备注：</strong>{{ item.notes }}
                  </div>
                  <div v-if="detail?.creator_notes" class="parchment-block">
                    <h4>作者说明 (Creator Notes)</h4>
                    <pre class="prose-pre">{{ detail.creator_notes }}</pre>
                  </div>
                </div>
              </div>

              <div v-if="detail?.description" class="parchment-block">
                <h4>角色描述 (Description)</h4>
                <pre class="prose-pre">{{ detail.description }}</pre>
              </div>

              <div v-if="detail?.personality" class="parchment-block">
                <h4>性格特征 (Personality)</h4>
                <pre class="prose-pre">{{ detail.personality }}</pre>
              </div>

              <div v-if="detail?.scenario" class="parchment-block">
                <h4>世界与场景 (Scenario)</h4>
                <pre class="prose-pre">{{ detail.scenario }}</pre>
              </div>

              <div v-if="detail?.system_prompt" class="parchment-block">
                <h4>系统提示词 (System Prompt)</h4>
                <pre class="prose-pre">{{ detail.system_prompt }}</pre>
              </div>

              <div v-if="detail?.post_history_instructions" class="parchment-block">
                <h4>历史后指令 (Post-History Instructions)</h4>
                <pre class="prose-pre">{{ detail.post_history_instructions }}</pre>
              </div>
            </div>

            <!-- CHARACTER: GREETINGS -->
            <div v-else-if="item.category === 'character' && activeTab === 'greetings'" class="parchment-stack">
              <div class="greeting-pills">
                <button
                  v-for="(g, idx) in allGreetings"
                  :key="idx"
                  class="skeuo-btn skeuo-btn-paper"
                  :class="{ 'active-pill': selectedGreeting === idx }"
                  @click="selectedGreeting = idx"
                >
                  {{ g.title }}
                </button>
              </div>
              <div v-if="allGreetings[selectedGreeting]" class="parchment-block">
                <div class="block-bar">
                  <h4>{{ allGreetings[selectedGreeting].title }}</h4>
                  <button class="skeuo-btn skeuo-btn-paper mini-btn" @click="copyText(allGreetings[selectedGreeting].text, 'greeting')">
                    <Check v-if="copiedKey === 'greeting'" :size="13" />
                    <Copy v-else :size="13" />
                    <span>{{ copiedKey === 'greeting' ? '已复制' : '复制' }}</span>
                  </button>
                </div>
                <pre class="prose-pre">{{ allGreetings[selectedGreeting].text }}</pre>
              </div>
            </div>

            <!-- CHARACTER / WORLDBOOK: ENTRIES -->
            <div
              v-else-if="(item.category === 'character' && activeTab === 'worldbook') || (item.category === 'worldbook' && activeTab === 'overview')"
              class="parchment-stack"
            >
              <div class="inline-search">
                <Search :size="14" />
                <input v-model="wbSearch" type="text" placeholder="按标题、触发词或正文搜索世界书词条…" />
                <span class="count-hint">{{ filteredWbEntries.length }} 条</span>
              </div>

              <div class="entry-list">
                <div
                  v-for="e in filteredWbEntries.slice(0, 120)"
                  :key="e.uid"
                  class="entry-card"
                >
                  <div class="entry-head" @click="expandedKey = expandedKey === e.uid ? null : e.uid">
                    <div class="entry-title-group">
                      <span class="led-dot" :class="!e.enabled ? 'led-off' : (e.constant ? 'led-amber' : 'led-green')"></span>
                      <strong>{{ e.comment }}</strong>
                      <span v-if="e.constant" class="stamp-badge stamp-brass">常驻</span>
                    </div>
                    <div class="entry-keys">
                      <span v-for="k in (e.keys || []).slice(0, 4)" :key="k" class="key-chip">{{ k }}</span>
                    </div>
                  </div>
                  <pre v-if="expandedKey === e.uid" class="prose-pre entry-body">{{ e.content }}</pre>
                </div>
              </div>
            </div>

            <!-- CHARACTER: EXTENSIONS -->
            <div v-else-if="item.category === 'character' && activeTab === 'extensions'" class="parchment-stack">
              <div class="parchment-block">
                <h4>内嵌扩展字段 (Extensions)</h4>
                <div class="tag-strip">
                  <span v-for="k in detail?.extension_keys || []" :key="k" class="stamp-badge stamp-ink">{{ k }}</span>
                </div>
              </div>

              <div v-if="detail?.regex_scripts?.length" class="parchment-block">
                <h4>内嵌正则脚本 ({{ detail.regex_scripts.length }})</h4>
                <div class="entry-list">
                  <div v-for="r in detail.regex_scripts" :key="r.id" class="entry-card">
                    <div class="entry-head">
                      <div class="entry-title-group">
                        <span class="led-dot" :class="r.disabled ? 'led-off' : 'led-green'"></span>
                        <strong>{{ r.scriptName }}</strong>
                      </div>
                    </div>
                    <div class="regex-code">Find: <code>{{ r.findRegex }}</code></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- PRESET: PARAMETERS -->
            <div v-else-if="item.category === 'preset' && activeTab === 'overview'" class="parchment-stack">
              <div class="lcd-screen param-grid">
                <div v-for="(val, key) in detail?.params || {}" :key="key" class="param-cell">
                  <span class="param-k">{{ key }}</span>
                  <span class="param-v">{{ val === null || val === '' ? '—' : String(val) }}</span>
                </div>
              </div>
              <div v-if="item.notes" class="note-callout">
                <strong>个人归档备注：</strong>{{ item.notes }}
              </div>
            </div>

            <!-- PRESET: PROMPTS -->
            <div v-else-if="item.category === 'preset' && activeTab === 'prompts'" class="parchment-stack">
              <div class="prompt-toolbar">
                <div class="inline-search" style="flex: 1">
                  <Search :size="14" />
                  <input v-model="promptSearch" type="text" placeholder="搜索提示词模块名称或内容…" />
                </div>
                <div class="rocker-group">
                  <button class="rocker-btn" :class="{ active: promptFilter === 'all' }" @click="promptFilter = 'all'">全部</button>
                  <button class="rocker-btn" :class="{ active: promptFilter === 'enabled' }" @click="promptFilter = 'enabled'">已启用</button>
                  <button class="rocker-btn" :class="{ active: promptFilter === 'disabled' }" @click="promptFilter = 'disabled'">未启用</button>
                </div>
              </div>

              <div class="entry-list">
                <div
                  v-for="p in filteredPrompts.slice(0, promptLimit)"
                  :key="p.identifier"
                  class="entry-card"
                >
                  <div class="entry-head" @click="expandedKey = expandedKey === p.identifier ? null : p.identifier">
                    <div class="entry-title-group">
                      <span class="led-dot" :class="p.enabled ? 'led-green' : 'led-off'"></span>
                      <strong>{{ p.name }}</strong>
                      <span class="stamp-badge stamp-ink">{{ p.role }}</span>
                      <span v-if="p.marker" class="stamp-badge stamp-brass">Marker</span>
                    </div>
                    <span class="mono-meta">Depth {{ p.injection_depth }} · Order {{ p.injection_order }}</span>
                  </div>
                  <div v-if="expandedKey === p.identifier" class="entry-body">
                    <div class="block-bar" style="margin-bottom: 8px">
                      <span class="mono-meta">ID: {{ p.identifier }}</span>
                      <button v-if="p.content" class="skeuo-btn skeuo-btn-paper mini-btn" @click.stop="copyText(p.content, p.identifier)">
                        <Check v-if="copiedKey === p.identifier" :size="12" />
                        <Copy v-else :size="12" />
                        <span>{{ copiedKey === p.identifier ? '已复制' : '复制内容' }}</span>
                      </button>
                    </div>
                    <pre class="prose-pre">{{ p.content || '（空分隔标题 / Marker 占位）' }}</pre>
                  </div>
                </div>
              </div>

              <button
                v-if="filteredPrompts.length > promptLimit"
                class="skeuo-btn skeuo-btn-paper"
                @click="promptLimit += 80"
              >
                加载更多模块（剩余 {{ filteredPrompts.length - promptLimit }} 个）
              </button>
            </div>

            <!-- THEME: VISUAL & SWATCHES -->
            <div v-else-if="item.category === 'theme' && activeTab === 'overview'" class="parchment-stack">
              <div
                class="theme-stage"
                :style="{ background: detail?.colors?.blur_tint_color || '#0e0e14' }"
              >
                <div
                  class="stage-msg"
                  :style="{
                    background: detail?.colors?.bot_mes_blur_tint_color || 'rgba(12,12,18,0.55)',
                    borderColor: detail?.colors?.border_color || 'rgba(255,255,255,0.14)',
                    color: detail?.colors?.main_text_color || '#eee',
                  }"
                >
                  <div class="stage-name">Character · 角色消息预览</div>
                  <p>
                    普通叙述正文展示。
                    <span :style="{ color: detail?.colors?.quote_text_color || '#fff', fontWeight: 600 }">“这是对话引号高亮文本。”</span>
                    <em :style="{ color: detail?.colors?.italics_text_color || '#ff4757' }"> *这是斜体心理活动与动作描写*</em>
                  </p>
                </div>
                <div
                  class="stage-msg"
                  :style="{
                    background: detail?.colors?.user_mes_blur_tint_color || 'rgba(20,20,30,0.55)',
                    borderColor: detail?.colors?.border_color || 'rgba(255,255,255,0.14)',
                    color: detail?.colors?.main_text_color || '#eee',
                  }"
                >
                  <div class="stage-name">User · 用户消息预览</div>
                  <p>
                    <u :style="{ color: detail?.colors?.underline_text_color || '#ff4757' }">下划线强调样式</u>
                    · 模糊强度 {{ detail?.blur_strength ?? 0 }}px · 对话宽度 {{ detail?.chat_width ?? 50 }}%
                  </p>
                </div>
              </div>

              <div class="parchment-block">
                <h4>主题色板（点击复制色值）</h4>
                <div class="swatch-grid">
                  <button
                    v-for="(val, key) in detail?.colors || {}"
                    :key="key"
                    class="swatch-tile"
                    @click="copyText(val, key)"
                  >
                    <span class="tile-dot" :style="{ background: val || 'transparent' }"></span>
                    <div class="tile-meta">
                      <span class="tile-k">{{ key }}</span>
                      <span class="tile-v">{{ copiedKey === key ? '已复制 ✓' : (val || '—') }}</span>
                    </div>
                  </button>
                </div>
              </div>

              <div class="parchment-block">
                <h4>界面开关状态</h4>
                <div class="toggle-grid">
                  <div v-for="(val, key) in detail?.toggles || {}" :key="key" class="toggle-item">
                    <span class="led-dot" :class="val ? 'led-green' : 'led-off'"></span>
                    <span>{{ key }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- THEME: CUSTOM CSS -->
            <div v-else-if="item.category === 'theme' && activeTab === 'css'" class="parchment-stack">
              <div class="block-bar">
                <span class="mono-meta">
                  共 {{ (detail?.custom_css || '').split('\n').length }} 行 · {{ formatBytes((detail?.custom_css || '').length) }}
                </span>
                <button class="skeuo-btn skeuo-btn-paper mini-btn" @click="copyText(detail?.custom_css || '', 'css')">
                  <Check v-if="copiedKey === 'css'" :size="13" />
                  <Copy v-else :size="13" />
                  <span>{{ copiedKey === 'css' ? '已复制 CSS' : '复制全部 CSS' }}</span>
                </button>
              </div>
              <pre class="code-well">{{ detail?.custom_css || '/* 该主题未包含 Custom CSS */' }}</pre>
            </div>

            <!-- OTHER: OVERVIEW -->
            <div v-else-if="item.category === 'other' && activeTab === 'overview'" class="parchment-stack">
              <div class="parchment-block">
                <h4>档案摘要</h4>
                <p>{{ item.summary }}</p>
                <p v-if="item.notes"><strong>备注：</strong>{{ item.notes }}</p>
              </div>
            </div>

            <!-- COMMON: EDIT METADATA -->
            <div v-else-if="activeTab === 'edit'" class="parchment-stack">
              <div class="edit-grid">
                <label class="edit-field">
                  <span>档案名称</span>
                  <input v-model="editForm.name" type="text" class="paper-input" />
                </label>
                <label class="edit-field">
                  <span>分类</span>
                  <select v-model="editForm.category" class="paper-input">
                    <option value="character">角色卡</option>
                    <option value="preset">对话预设</option>
                    <option value="theme">界面主题</option>
                    <option value="worldbook">世界书</option>
                    <option value="other">正则与扩展</option>
                  </select>
                </label>
                <label class="edit-field">
                  <span>作者</span>
                  <input v-model="editForm.creator" type="text" class="paper-input" />
                </label>
                <label class="edit-field">
                  <span>版本</span>
                  <input v-model="editForm.version" type="text" class="paper-input" />
                </label>
                <label class="edit-field">
                  <span>档案抽屉（文件夹）</span>
                  <input v-model="editForm.folder" type="text" placeholder="留空表示不归类" class="paper-input" />
                </label>
                <label class="edit-field">
                  <span>标签（逗号分隔）</span>
                  <input v-model="editForm.tagsText" type="text" placeholder="例如：V3, 仙侠, 常用" class="paper-input" />
                </label>
                <label class="edit-field full-span">
                  <span>个人归档备注</span>
                  <textarea v-model="editForm.notes" rows="4" placeholder="记录适配模型、使用注意事项、来源链接等…" class="paper-input"></textarea>
                </label>
              </div>
              <div style="display: flex; justify-content: flex-end">
                <button class="skeuo-btn skeuo-btn-brass" :disabled="savingEdit" @click="saveEdit">
                  <Save :size="14" />
                  <span>{{ savingEdit ? '保存中…' : '保存修改' }}</span>
                </button>
              </div>
            </div>

            <!-- COMMON: RAW JSON -->
            <div v-else-if="activeTab === 'raw'" class="parchment-stack">
              <div class="block-bar">
                <span class="mono-meta">
                  {{ rawTruncated ? '文件较大，仅预览前 150 KB（完整内容请直接下载或导出 JSON）' : '完整 JSON 结构' }}
                </span>
                <button v-if="rawText" class="skeuo-btn skeuo-btn-paper mini-btn" @click="copyText(rawText, 'raw')">
                  <Check v-if="copiedKey === 'raw'" :size="13" />
                  <Copy v-else :size="13" />
                  <span>{{ copiedKey === 'raw' ? '已复制' : '复制预览' }}</span>
                </button>
              </div>
              <div v-if="rawLoading" class="drawer-loading">正在读取 JSON…</div>
              <pre v-else class="code-well">{{ rawText }}</pre>
            </div>
          </div>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 7, 5, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
  z-index: 90;
}

.folio-drawer {
  width: min(920px, 95vw);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #241a15;
  border-left: 3px solid #5a4332;
  box-shadow: -16px 0 48px rgba(0, 0, 0, 0.75);
}

.drawer-loading {
  padding: 60px;
  text-align: center;
  color: #cbb79e;
  font-size: 14px;
}

.drawer-header {
  padding: 18px 24px 14px;
  background: linear-gradient(180deg, #362820 0%, #261c16 100%);
  border-bottom: 1px solid #140e0b;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.dh-badges {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}

.dh-size {
  font-family: var(--font-mono);
  font-size: 11px;
  color: #bba68e;
}

.dh-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 21px;
  color: #f7ebd7;
}

.dh-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #b49e88;
}

.dh-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Physical Tab Dividers */
.folio-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 24px 0;
  background: #1d1511;
  border-bottom: 2px solid #b59e7d;
  overflow-x: auto;
}

.folio-tab {
  padding: 8px 15px;
  border: 1px solid #4a392d;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #3a2c23 0%, #2b201a 100%);
  color: #cbb8a2;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.folio-tab.active {
  color: var(--paper-ink);
  background: linear-gradient(180deg, #f8f2e6 0%, #efe4d0 100%);
  border-color: #b59e7d;
  margin-bottom: -2px;
  padding-bottom: 10px;
}

/* Parchment Interior */
.folio-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 26px 32px;
  color: var(--paper-ink);
  background:
    radial-gradient(circle at 20% 0%, rgba(255, 255, 255, 0.45), transparent 50%),
    linear-gradient(180deg, #f3ead9 0%, #e7dac2 100%);
}

.parchment-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.char-hero {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

.hero-cover {
  position: relative;
  width: 190px;
  height: 256px;
  flex-shrink: 0;
  border-radius: 9px;
  overflow: hidden;
  border: 3px solid #ad9572;
  background: #231914;
  box-shadow: 0 6px 16px rgba(45, 30, 15, 0.35);
  cursor: pointer;
}

.hero-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #b8a38b;
  font-size: 12px;
  text-align: center;
  padding: 12px;
}

.cover-overlay {
  position: absolute;
  inset: auto 0 0 0;
  padding: 6px;
  text-align: center;
  font-size: 12px;
  color: #fff;
  background: rgba(20, 14, 10, 0.72);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.hero-cover:hover .cover-overlay {
  opacity: 1;
}

.hero-info {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tag-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.note-callout {
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(201, 154, 78, 0.18);
  border: 1px solid rgba(155, 112, 42, 0.45);
  font-size: 13px;
}

.parchment-block {
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(255, 252, 245, 0.65);
  border: 1px solid #cab89a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 2px 6px rgba(55, 40, 20, 0.08);
}

.parchment-block h4 {
  margin: 0 0 9px;
  font-family: var(--font-serif);
  font-size: 14.5px;
  color: #463423;
}

.prose-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.72;
  color: #2f241a;
}

.greeting-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.active-pill {
  background: linear-gradient(180deg, #f3d79e 0%, #c89648 100%) !important;
  border-color: #7d561d !important;
}

.block-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mini-btn {
  padding: 4px 10px;
  font-size: 12px;
}

.inline-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 38px;
  border-radius: 8px;
  background: rgba(255, 252, 246, 0.85);
  border: 1px solid #b59e7d;
  box-shadow: inset 0 2px 4px rgba(70, 52, 32, 0.14);
}

.inline-search input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--paper-ink);
}

.count-hint {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: #7a6650;
}

.prompt-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-card {
  border-radius: 9px;
  background: rgba(255, 252, 245, 0.78);
  border: 1px solid #c6b395;
  overflow: hidden;
}

.entry-head {
  padding: 10px 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  flex-wrap: wrap;
}

.entry-head:hover {
  background: rgba(201, 154, 78, 0.12);
}

.entry-title-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}

.entry-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.key-chip {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 5px;
  background: rgba(130, 102, 68, 0.15);
  color: #5d4935;
}

.entry-body {
  padding: 12px 14px;
  border-top: 1px dashed #cbb89a;
  background: rgba(246, 239, 226, 0.6);
}

.regex-code {
  padding: 0 13px 10px;
  font-size: 12px;
  color: #6b5540;
}

.mono-meta {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: #7a6650;
}

/* Preset Params LCD */
.param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
  gap: 12px;
  padding: 16px;
}

.param-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(155, 232, 184, 0.12);
}

.param-k {
  font-size: 10.5px;
  color: #6ba581;
}

.param-v {
  font-size: 14px;
  font-weight: 600;
}

/* Theme Live Preview */
.theme-stage {
  padding: 18px;
  border-radius: 11px;
  border: 2px solid #9d8564;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 3px 12px rgba(0, 0, 0, 0.65);
}

.stage-msg {
  padding: 12px 15px;
  border-radius: 8px;
  border: 1px solid;
  backdrop-filter: blur(10px);
}

.stage-msg p {
  margin: 6px 0 0;
  font-size: 13.5px;
  line-height: 1.65;
}

.stage-name {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.85;
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}

.swatch-tile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #c6b395;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  text-align: left;
}

.swatch-tile:hover {
  background: #fff;
}

.tile-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.tile-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tile-k {
  font-size: 11px;
  color: #705b45;
}

.tile-v {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: #2b2118;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: #463626;
}

.code-well {
  margin: 0;
  padding: 14px 16px;
  border-radius: 9px;
  background: #171311;
  color: #e6dac8;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  max-height: 62vh;
  border: 1px solid #0e0a08;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8);
}

/* Edit Form */
.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #54412f;
}

.full-span {
  grid-column: 1 / -1;
}

.paper-input {
  width: 100%;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid #b59e7d;
  background: rgba(255, 253, 248, 0.9);
  color: var(--paper-ink);
  font-family: inherit;
  font-size: 13.5px;
  box-shadow: inset 0 2px 4px rgba(70, 52, 32, 0.14);
  outline: none;
}

.paper-input:focus {
  border-color: #9e6e24;
  box-shadow: inset 0 2px 4px rgba(70, 52, 32, 0.14), 0 0 0 2px rgba(201, 154, 78, 0.25);
}
</style>
