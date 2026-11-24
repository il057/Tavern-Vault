<script setup>
import { computed } from 'vue';
import {
  Star,
  Download,
  UserSquare2,
  BookOpen,
  Sliders,
  Palette,
  Puzzle,
  Folder,
  FileJson,
  Image as ImageIcon,
  Layers,
} from 'lucide-vue-next';
import { formatBytes, getDownloadUrl } from '../api/vault.js';
import LiquidGlass from './LiquidGlass.vue';

const props = defineProps({
  item: { type: Object, required: true },
  viewMode: { type: String, default: 'grid' },
});

const emit = defineEmits(['open', 'toggle-favorite']);

const categoryLabel = computed(() => {
  const map = {
    character: '角色卡',
    preset: '对话预设',
    theme: '界面主题',
    worldbook: '世界书',
    other: '正则/扩展',
  };
  return map[props.item.category] || '档案';
});

const themeSwatches = computed(() => {
  const c = props.item.metadata?.colors;
  if (!c) return [];
  return [
    { label: '正文', color: c.main_text },
    { label: '斜体', color: c.italics_text },
    { label: '引号', color: c.quote_text },
    { label: '气泡', color: c.bot_mes },
    { label: '用户', color: c.user_mes },
    { label: '边框', color: c.border },
  ].filter((s) => s.color);
});

const formatNum = (n) => {
  if (n === null || n === undefined) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
};

const formattedVersion = computed(() => {
  const v = (props.item.version || '').trim();
  if (!v) return '';
  return /^\d/.test(v) ? `v${v}` : v;
});
</script>

<template>
  <!-- LIST VIEW (Liquid Glass Row) -->
  <LiquidGlass
    v-if="viewMode === 'list'"
    tag="div"
    variant="surface"
    :radius="20"
    :bezel-width="16"
    :blur="2"
    :saturate="1.42"
    :dispersion="true"
    :max-dim="360"
    :strength="0.65"
    class="list-row liquid-card-interactive"
    tabindex="0"
    @click="emit('open', item)"
    @keydown.enter.self="emit('open', item)"
  >
    <div class="list-thumb" :class="`thumb-${item.category}`">
      <img v-if="item.cover_url" :src="item.cover_url" :alt="item.name" />
      <UserSquare2 v-else-if="item.category === 'character'" :size="20" />
      <Sliders v-else-if="item.category === 'preset'" :size="20" />
      <Palette v-else-if="item.category === 'theme'" :size="20" />
      <BookOpen v-else-if="item.category === 'worldbook'" :size="20" />
      <Puzzle v-else :size="20" />
    </div>

    <div class="list-main">
      <div class="list-title-row">
        <span class="list-title">{{ item.name }}</span>
        <span v-if="formattedVersion" class="status-badge badge-neutral">{{ formattedVersion }}</span>
        <span v-if="item.version_count > 1" class="status-badge badge-sage version-stack-badge" :title="`共 ${item.version_count} 个版本，点击进入详情切换`">
          <Layers :size="11" /> {{ item.version_count }} 版本
        </span>
        <span class="status-badge" :class="item.format === 'png' ? 'badge-scene' : 'badge-sage'">
          {{ item.format.toUpperCase() }}
        </span>
        <span class="status-badge badge-neutral">{{ categoryLabel }}</span>
        <span v-if="item.folder" class="folder-chip">
          <Folder :size="11" /> {{ item.folder }}
        </span>
      </div>
      <div class="list-summary">{{ item.summary || item.original_filename }}</div>
    </div>

    <div class="list-meta">
      <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
      <button
        type="button"
        class="icon-action"
        :class="{ starred: item.favorite }"
        title="星标收藏"
        aria-label="星标收藏"
        @click.stop="emit('toggle-favorite', item)"
      >
        <Star :size="15" :fill="item.favorite ? 'currentColor' : 'none'" />
      </button>
      <a
        :href="getDownloadUrl(item.id)"
        class="icon-action"
        title="下载原文件"
        aria-label="下载原文件"
        @click.stop
      >
        <Download :size="15" />
      </a>
    </div>
  </LiquidGlass>

  <!-- GRID VIEW: PRESET (Liquid Glass Tile) -->
  <LiquidGlass
    v-else-if="item.category === 'preset'"
    tag="article"
    variant="surface"
    :radius="24"
    :bezel-width="22"
    :blur="2"
    :saturate="1.42"
    :dispersion="true"
    :max-dim="360"
    :strength="0.72"
    class="grid-card preset-card liquid-card-interactive"
    tabindex="0"
    @click="emit('open', item)"
    @keydown.enter.self="emit('open', item)"
  >
    <div class="card-layer preset-layer">
      <div class="card-top-row">
        <div class="preset-kicker">
          <span class="status-dot" :class="item.metadata?.prompts_enabled > 0 ? 'active' : 'amber'"></span>
          <span>PRESET</span>
          <span v-if="formattedVersion" class="status-badge badge-neutral">{{ formattedVersion }}</span>
          <span v-if="item.version_count > 1" class="status-badge badge-sage version-stack-badge" :title="`共 ${item.version_count} 个版本`">
            <Layers :size="11" /> {{ item.version_count }} 版本
          </span>
        </div>
        <div class="card-inline-actions">
          <button
            type="button"
            class="icon-action"
            :class="{ starred: item.favorite }"
            title="收藏"
            aria-label="收藏"
            @click.stop="emit('toggle-favorite', item)"
          >
            <Star :size="15" :fill="item.favorite ? 'currentColor' : 'none'" />
          </button>
          <a
            :href="getDownloadUrl(item.id)"
            class="icon-action"
            title="下载原文件"
            aria-label="下载原文件"
            @click.stop
          >
            <Download :size="15" />
          </a>
        </div>
      </div>

      <h3 class="card-title" :title="item.name">{{ item.name }}</h3>

      <div class="param-grid">
        <div class="param-cell">
          <span class="param-k">TEMP</span>
          <span class="param-v">{{ item.metadata?.temperature ?? '—' }}</span>
        </div>
        <div class="param-cell">
          <span class="param-k">TOP-P</span>
          <span class="param-v">{{ item.metadata?.top_p ?? '—' }}</span>
        </div>
        <div class="param-cell">
          <span class="param-k">CTX</span>
          <span class="param-v">{{ formatNum(item.metadata?.max_context) }}</span>
        </div>
        <div class="param-cell">
          <span class="param-k">PROMPTS</span>
          <span class="param-v">{{ item.metadata?.prompts_enabled ?? 0 }}/{{ item.metadata?.prompts_total ?? 0 }}</span>
        </div>
      </div>

      <p class="card-summary">{{ item.summary }}</p>

      <div class="card-footer">
        <div class="meta-pills">
          <span v-for="t in item.tags.slice(0, 3)" :key="t" class="status-badge badge-neutral">{{ t }}</span>
        </div>
        <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
      </div>
    </div>
  </LiquidGlass>

  <!-- GRID VIEW: THEME (Liquid Glass Tile + Clear Glass Actions over Preview Scene) -->
  <LiquidGlass
    v-else-if="item.category === 'theme'"
    tag="article"
    variant="surface"
    :radius="24"
    :bezel-width="22"
    :blur="2"
    :saturate="1.42"
    :dispersion="true"
    :max-dim="360"
    :strength="0.72"
    class="grid-card theme-card liquid-card-interactive"
    tabindex="0"
    @click="emit('open', item)"
    @keydown.enter.self="emit('open', item)"
  >
    <div class="card-layer">
      <div class="theme-preview-window" :style="{ background: item.metadata?.colors?.blur_tint || '#25414A' }">
        <div
          class="mini-bubble"
          :style="{
            background: item.metadata?.colors?.bot_mes || 'rgba(20, 28, 34, 0.76)',
            borderColor: item.metadata?.colors?.border || 'rgba(255, 255, 255, 0.2)',
            color: item.metadata?.colors?.main_text || '#fff',
          }"
        >
          <span :style="{ color: item.metadata?.colors?.quote_text || '#fff' }">“星尘落进夜色”</span>
          <em :style="{ color: item.metadata?.colors?.italics_text || '#a7d8d2' }"> *轻声低语*</em>
        </div>

        <div class="floating-actions">
          <LiquidGlass
            tag="button"
            type="button"
            variant="clear"
            :radius="999"
            :bezel-width="8"
            :dispersion="false"
            :interactive="true"
            class="clear-glass-icon-btn"
            :class="{ starred: item.favorite }"
            title="收藏"
            aria-label="收藏"
            @click.stop="emit('toggle-favorite', item)"
          >
            <Star :size="14" :fill="item.favorite ? 'currentColor' : 'none'" />
          </LiquidGlass>
          <LiquidGlass
            tag="a"
            :href="getDownloadUrl(item.id)"
            variant="clear"
            :radius="999"
            :bezel-width="8"
            :dispersion="false"
            :interactive="true"
            class="clear-glass-icon-btn"
            title="下载原文件"
            aria-label="下载原文件"
            @click.stop
          >
            <Download :size="14" />
          </LiquidGlass>
        </div>
      </div>

      <div class="swatch-strip">
        <span
          v-for="(sw, idx) in themeSwatches"
          :key="idx"
          class="swatch-chip"
          :style="{ background: sw.color }"
          :title="`${sw.label}: ${sw.color}`"
        ></span>
      </div>

      <div class="card-body">
        <div class="card-head-row">
          <h3 class="card-title" :title="item.name">{{ item.name }}</h3>
          <div class="head-badges">
            <span v-if="item.version_count > 1" class="status-badge badge-sage version-stack-badge" :title="`共 ${item.version_count} 个版本`">
              <Layers :size="11" /> {{ item.version_count }} 版本
            </span>
            <span class="status-badge badge-sage">THEME</span>
          </div>
        </div>
        <p class="card-summary">{{ item.summary }}</p>
        <div class="card-footer">
          <div class="meta-pills">
            <span class="status-badge badge-neutral">Blur {{ item.metadata?.blur_strength ?? 0 }}px</span>
            <span v-if="item.metadata?.custom_css_lines" class="status-badge badge-neutral">
              CSS {{ item.metadata.custom_css_lines }} 行
            </span>
          </div>
          <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
        </div>
      </div>
    </div>
  </LiquidGlass>

  <!-- GRID VIEW: CHARACTER / WORLDBOOK / OTHER (Liquid Glass Tile) -->
  <LiquidGlass
    v-else
    tag="article"
    variant="surface"
    :radius="24"
    :bezel-width="22"
    :blur="2"
    :saturate="1.42"
    :dispersion="true"
    :max-dim="360"
    :strength="0.72"
    class="grid-card liquid-card-interactive"
    tabindex="0"
    @click="emit('open', item)"
    @keydown.enter.self="emit('open', item)"
  >
    <div class="card-layer">
      <div v-if="item.category === 'character'" class="portrait-frame">
        <img v-if="item.cover_url" :src="item.cover_url" :alt="item.name" loading="lazy" />
        <div v-else class="portrait-placeholder">
          <UserSquare2 :size="40" stroke-width="1.4" />
          <span>无封面原画</span>
        </div>

        <div class="portrait-badges">
          <span class="clear-badge-pill">
            <ImageIcon v-if="item.format === 'png'" :size="11" />
            <FileJson v-else :size="11" />
            {{ item.format.toUpperCase() }}
          </span>
          <span v-if="item.metadata?.spec === 'chara_card_v3'" class="clear-badge-pill">V3</span>
          <span v-else-if="item.metadata?.spec === 'chara_card_v2'" class="clear-badge-pill">V2</span>
          <span v-if="formattedVersion" class="clear-badge-pill">{{ formattedVersion }}</span>
          <span
            v-if="item.version_count > 1"
            class="clear-badge-pill version-pill-accent"
            :title="`共 ${item.version_count} 个版本，打开详情可切换`"
          >
            <Layers :size="11" />
            {{ item.version_count }} 版本
          </span>
        </div>

        <div class="floating-actions">
          <LiquidGlass
            tag="button"
            type="button"
            variant="clear"
            :radius="999"
            :bezel-width="8"
            :dispersion="false"
            :interactive="true"
            class="clear-glass-icon-btn"
            :class="{ starred: item.favorite }"
            title="收藏"
            aria-label="收藏"
            @click.stop="emit('toggle-favorite', item)"
          >
            <Star :size="14" :fill="item.favorite ? 'currentColor' : 'none'" />
          </LiquidGlass>
          <LiquidGlass
            tag="a"
            :href="getDownloadUrl(item.id)"
            variant="clear"
            :radius="999"
            :bezel-width="8"
            :dispersion="false"
            :interactive="true"
            class="clear-glass-icon-btn"
            title="下载原文件"
            aria-label="下载原文件"
            @click.stop
          >
            <Download :size="14" />
          </LiquidGlass>
        </div>
      </div>

      <div v-else class="index-banner" :class="`banner-${item.category}`">
        <div class="banner-label">
          <BookOpen v-if="item.category === 'worldbook'" :size="20" />
          <Puzzle v-else :size="20" />
          <span>{{ categoryLabel }}</span>
        </div>
        <div class="card-inline-actions">
          <button
            type="button"
            class="icon-action"
            :class="{ starred: item.favorite }"
            title="收藏"
            aria-label="收藏"
            @click.stop="emit('toggle-favorite', item)"
          >
            <Star :size="15" :fill="item.favorite ? 'currentColor' : 'none'" />
          </button>
          <a
            :href="getDownloadUrl(item.id)"
            class="icon-action"
            title="下载原文件"
            aria-label="下载原文件"
            @click.stop
          >
            <Download :size="15" />
          </a>
        </div>
      </div>

      <div class="card-body">
        <div class="card-head-row">
          <h3 class="card-title" :title="item.name">{{ item.name }}</h3>
          <div v-if="item.category !== 'character' && (formattedVersion || item.version_count > 1)" class="head-badges">
            <span v-if="formattedVersion" class="status-badge badge-neutral">{{ formattedVersion }}</span>
            <span v-if="item.version_count > 1" class="status-badge badge-sage version-stack-badge" :title="`共 ${item.version_count} 个版本`">
              <Layers :size="11" /> {{ item.version_count }} 版本
            </span>
          </div>
        </div>
        <div v-if="item.creator || item.folder" class="sub-meta">
          <span v-if="item.creator">作者：{{ item.creator }}</span>
          <span v-if="item.folder" class="folder-inline">
            <Folder :size="11" /> {{ item.folder }}
          </span>
        </div>
        <p class="card-summary">{{ item.summary }}</p>

        <div class="card-footer">
          <div class="meta-pills">
            <span v-if="item.metadata?.worldbook_entries_count" class="status-badge badge-sage">
              世界书 {{ item.metadata.worldbook_entries_count }}
            </span>
            <span v-if="item.metadata?.alt_greetings_count" class="status-badge badge-neutral">
              开场 {{ item.metadata.alt_greetings_count + 1 }}
            </span>
            <span v-if="item.metadata?.entries_count" class="status-badge badge-sage">
              词条 {{ item.metadata.entries_count }}
            </span>
          </div>
          <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
        </div>
      </div>
    </div>
  </LiquidGlass>
</template>

<style scoped>
.grid-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  cursor: pointer;
}

.card-layer {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.preset-layer {
  padding: var(--spacing-24);
  gap: var(--spacing-12);
}

/* Portrait Scene */
.portrait-frame {
  position: relative;
  height: 224px;
  margin: 10px 10px 0;
  border-radius: 17px;
  overflow: hidden;
  background: var(--color-glass-scene);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 4px 14px rgba(10, 22, 42, 0.14);
}

:root[data-theme='dark'] .portrait-frame {
  border-color: rgba(255, 255, 255, 0.18);
}

.portrait-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
  display: block;
}

.portrait-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.72);
  font-size: var(--text-label);
}

.portrait-badges {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.clear-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  color: #ffffff;
  background: rgba(12, 24, 42, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.34);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.version-pill-accent {
  background: rgba(37, 99, 235, 0.78);
  border-color: rgba(191, 219, 254, 0.65);
}

.version-stack-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.head-badges {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.floating-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  z-index: 5;
}

/* Theme Preview Scene */
.theme-preview-window {
  position: relative;
  height: 152px;
  margin: 10px 10px 0;
  border-radius: 17px;
  padding: var(--spacing-16);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: 0 4px 14px rgba(10, 22, 42, 0.14);
}

:root[data-theme='dark'] .theme-preview-window {
  border-color: rgba(255, 255, 255, 0.18);
}

.mini-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 12.5px;
  line-height: 1.45;
  max-width: 85%;
  backdrop-filter: blur(8px);
}

.swatch-strip {
  display: flex;
  gap: 6px;
  padding: 12px 20px 0;
}

.swatch-chip {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 1px 3px rgba(10, 22, 42, 0.12);
}

/* Non-portrait Index Banner */
.index-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 0;
}

.banner-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-label);
  color: var(--color-focus);
  text-transform: uppercase;
}

/* Preset Card */
.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preset-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.08em;
  color: var(--ink-muted);
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-8);
  padding: 10px;
  border-radius: var(--radius-inner);
  background: rgba(255, 255, 255, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.48);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

:root[data-theme='dark'] .param-grid {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.param-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
}

.param-k {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-muted);
}

.param-v {
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: var(--font-weight-semibold);
  color: var(--ink-primary);
}

/* Shared Card Body */
.card-body {
  padding: 14px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-8);
  flex: 1;
}

.card-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-8);
}

.card-title {
  margin: 0;
  font-size: 16.5px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
  color: var(--ink-primary);
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.4);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:root[data-theme='dark'] .card-title {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.sub-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: var(--text-label);
  color: var(--ink-muted);
}

.folder-inline,
.folder-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-label);
  color: var(--ink-secondary);
}

.card-summary {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.52;
  color: var(--ink-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-8);
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.38);
}

:root[data-theme='dark'] .card-footer {
  border-top-color: rgba(255, 255, 255, 0.12);
}

.meta-pills {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.mono-size {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--ink-muted);
  flex-shrink: 0;
}

.card-inline-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-secondary);
  cursor: pointer;
  text-decoration: none;
  transition:
    transform var(--ease-spring),
    background 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.icon-action:hover {
  background: rgba(255, 255, 255, 0.36);
  border-color: rgba(255, 255, 255, 0.52);
  color: var(--ink-primary);
}

:root[data-theme='dark'] .icon-action:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.22);
}

.icon-action:active {
  transform: scale(0.96);
  transition: transform var(--ease-press);
}

.icon-action.starred {
  color: #d97706;
}

/* List Row */
.list-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-16);
  padding: var(--spacing-12) var(--spacing-16);
  cursor: pointer;
}

.list-thumb,
.list-main,
.list-meta {
  position: relative;
  z-index: 4;
}

.list-thumb {
  width: 48px;
  height: 48px;
  border-radius: 13px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.45);
  color: var(--color-focus);
  flex-shrink: 0;
}

:root[data-theme='dark'] .list-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
}

.list-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.list-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-8);
  flex-wrap: wrap;
}

.list-title {
  font-size: 15px;
  font-weight: var(--font-weight-semibold);
  color: var(--ink-primary);
}

.list-summary {
  font-size: 13px;
  color: var(--ink-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-8);
  flex-shrink: 0;
}
</style>
