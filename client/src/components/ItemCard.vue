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
} from 'lucide-vue-next';
import { formatBytes, getDownloadUrl } from '../api/vault.js';

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
</script>

<template>
  <!-- LIST VIEW -->
  <div
    v-if="viewMode === 'list'"
    class="list-row"
    :class="item.category === 'preset' ? 'hardware-card' : 'paper-card'"
    @click="emit('open', item)"
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
        <span class="stamp-badge" :class="item.format === 'png' ? 'stamp-vermilion' : 'stamp-cobalt'">
          {{ item.format.toUpperCase() }}
        </span>
        <span class="stamp-badge stamp-ink">{{ categoryLabel }}</span>
        <span v-if="item.folder" class="folder-chip">
          <Folder :size="11" /> {{ item.folder }}
        </span>
      </div>
      <div class="list-summary">{{ item.summary || item.original_filename }}</div>
    </div>

    <div class="list-meta">
      <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
      <button
        class="icon-action"
        :class="{ starred: item.favorite }"
        title="星标收藏"
        @click.stop="emit('toggle-favorite', item)"
      >
        <Star :size="15" :fill="item.favorite ? 'currentColor' : 'none'" />
      </button>
      <a
        :href="getDownloadUrl(item.id)"
        class="icon-action"
        title="下载原文件"
        @click.stop
      >
        <Download :size="15" />
      </a>
    </div>
  </div>

  <!-- GRID VIEW: PRESET (Modern Anodized Hardware Module) -->
  <article
    v-else-if="item.category === 'preset'"
    class="hardware-card grid-card preset-card"
    @click="emit('open', item)"
  >
    <span class="pin-magnet pin-cobalt"></span>

    <div class="hw-header">
      <div class="hw-left">
        <span class="led-dot" :class="item.metadata?.prompts_enabled > 0 ? 'led-green' : 'led-amber'"></span>
        <span class="hw-model">PRESET MODULE</span>
      </div>
      <div class="card-actions">
        <button
          class="mini-tool-btn"
          :class="{ starred: item.favorite }"
          title="收藏"
          @click.stop="emit('toggle-favorite', item)"
        >
          <Star :size="14" :fill="item.favorite ? 'currentColor' : 'none'" />
        </button>
        <a :href="getDownloadUrl(item.id)" class="mini-tool-btn" title="下载原文件" @click.stop>
          <Download :size="14" />
        </a>
      </div>
    </div>

    <h3 class="hw-title" :title="item.name">{{ item.name }}</h3>

    <!-- Recessed OLED Readout -->
    <div class="lcd-screen preset-lcd">
      <div class="lcd-cell">
        <span class="lcd-k">TEMP</span>
        <span class="lcd-v">{{ item.metadata?.temperature ?? '—' }}</span>
      </div>
      <div class="lcd-cell">
        <span class="lcd-k">TOP-P</span>
        <span class="lcd-v">{{ item.metadata?.top_p ?? '—' }}</span>
      </div>
      <div class="lcd-cell">
        <span class="lcd-k">CTX</span>
        <span class="lcd-v">{{ formatNum(item.metadata?.max_context) }}</span>
      </div>
      <div class="lcd-cell">
        <span class="lcd-k">PROMPTS</span>
        <span class="lcd-v">{{ item.metadata?.prompts_enabled ?? 0 }}/{{ item.metadata?.prompts_total ?? 0 }}</span>
      </div>
    </div>

    <p class="hw-summary">{{ item.summary }}</p>

    <div class="card-footer hw-footer">
      <div class="tag-row">
        <span v-for="t in item.tags.slice(0, 3)" :key="t" class="hw-tag">{{ t }}</span>
      </div>
      <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
    </div>
  </article>

  <!-- GRID VIEW: THEME (Pantone Swatch Card taped to board) -->
  <article
    v-else-if="item.category === 'theme'"
    class="paper-card grid-card theme-card"
    @click="emit('open', item)"
  >
    <span class="washi-tape"></span>

    <div class="theme-preview-window" :style="{ background: item.metadata?.colors?.blur_tint || '#111622' }">
      <div
        class="mini-bubble"
        :style="{
          background: item.metadata?.colors?.bot_mes || 'rgba(20,24,36,0.72)',
          borderColor: item.metadata?.colors?.border || 'rgba(255,255,255,0.18)',
          color: item.metadata?.colors?.main_text || '#fff',
        }"
      >
        <span :style="{ color: item.metadata?.colors?.quote_text || '#fff' }">“星尘落进夜色”</span>
        <em :style="{ color: item.metadata?.colors?.italics_text || '#ff6b81' }"> *轻声低语*</em>
      </div>

      <div class="floating-actions">
        <button
          class="glass-btn"
          :class="{ starred: item.favorite }"
          title="收藏"
          @click.stop="emit('toggle-favorite', item)"
        >
          <Star :size="14" :fill="item.favorite ? 'currentColor' : 'none'" />
        </button>
        <a :href="getDownloadUrl(item.id)" class="glass-btn" title="下载" @click.stop>
          <Download :size="14" />
        </a>
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
        <h3 class="paper-title" :title="item.name">{{ item.name }}</h3>
        <span class="stamp-badge stamp-cobalt">THEME</span>
      </div>
      <p class="paper-summary">{{ item.summary }}</p>
      <div class="card-footer paper-footer">
        <div class="meta-pills">
          <span class="stamp-badge stamp-ink">Blur {{ item.metadata?.blur_strength ?? 0 }}px</span>
          <span v-if="item.metadata?.custom_css_lines" class="stamp-badge stamp-ink">
            CSS {{ item.metadata.custom_css_lines }} 行
          </span>
        </div>
        <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
      </div>
    </div>
  </article>

  <!-- GRID VIEW: CHARACTER / WORLDBOOK / OTHER (Pinned Polaroid / Index Card) -->
  <article
    v-else
    class="paper-card grid-card char-card"
    @click="emit('open', item)"
  >
    <span
      class="pin-magnet"
      :class="
        item.category === 'worldbook'
          ? 'pin-mint'
          : item.format === 'png'
            ? 'pin-vermilion'
            : 'pin-cobalt'
      "
    ></span>

    <div v-if="item.category === 'character'" class="portrait-frame">
      <img v-if="item.cover_url" :src="item.cover_url" :alt="item.name" loading="lazy" />
      <div v-else class="portrait-placeholder">
        <UserSquare2 :size="42" stroke-width="1.4" />
        <span>无封面原画</span>
      </div>
      <div class="glass-sheen"></div>

      <div class="portrait-badges">
        <span class="stamp-badge" :class="item.format === 'png' ? 'stamp-vermilion' : 'stamp-cobalt-solid'">
          <ImageIcon v-if="item.format === 'png'" :size="10" />
          <FileJson v-else :size="10" />
          {{ item.format.toUpperCase() }}
        </span>
        <span v-if="item.metadata?.spec === 'chara_card_v3'" class="stamp-badge stamp-cobalt-solid">V3</span>
        <span v-else-if="item.metadata?.spec === 'chara_card_v2'" class="stamp-badge glass-pill">V2</span>
      </div>

      <div class="floating-actions">
        <button
          class="glass-btn"
          :class="{ starred: item.favorite }"
          title="收藏"
          @click.stop="emit('toggle-favorite', item)"
        >
          <Star :size="14" :fill="item.favorite ? 'currentColor' : 'none'" />
        </button>
        <a :href="getDownloadUrl(item.id)" class="glass-btn" title="下载原文件" @click.stop>
          <Download :size="14" />
        </a>
      </div>
    </div>

    <div v-else class="index-banner" :class="`banner-${item.category}`">
      <BookOpen v-if="item.category === 'worldbook'" :size="24" />
      <Puzzle v-else :size="24" />
      <span>{{ categoryLabel }}</span>
      <div class="floating-actions">
        <button
          class="glass-btn light-action"
          :class="{ starred: item.favorite }"
          title="收藏"
          @click.stop="emit('toggle-favorite', item)"
        >
          <Star :size="14" :fill="item.favorite ? 'currentColor' : 'none'" />
        </button>
        <a :href="getDownloadUrl(item.id)" class="glass-btn light-action" title="下载原文件" @click.stop>
          <Download :size="14" />
        </a>
      </div>
    </div>

    <div class="card-body">
      <div class="card-head-row">
        <h3 class="paper-title" :title="item.name">{{ item.name }}</h3>
      </div>
      <div v-if="item.creator || item.folder" class="sub-meta">
        <span v-if="item.creator">作者：{{ item.creator }}</span>
        <span v-if="item.folder" class="folder-inline"><Folder :size="11" /> {{ item.folder }}</span>
      </div>
      <p class="paper-summary">{{ item.summary }}</p>

      <div class="card-footer paper-footer">
        <div class="meta-pills">
          <span v-if="item.metadata?.worldbook_entries_count" class="stamp-badge stamp-mint">
            世界书 {{ item.metadata.worldbook_entries_count }}
          </span>
          <span v-if="item.metadata?.alt_greetings_count" class="stamp-badge stamp-ink">
            开场 {{ item.metadata.alt_greetings_count + 1 }}
          </span>
          <span v-if="item.metadata?.entries_count" class="stamp-badge stamp-mint">
            词条 {{ item.metadata.entries_count }}
          </span>
        </div>
        <span class="mono-size">{{ formatBytes(item.file_size) }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.grid-card {
  display: flex;
  flex-direction: column;
  overflow: visible;
  cursor: pointer;
}

/* Polaroid-Style Portrait Frame */
.portrait-frame {
  position: relative;
  height: 222px;
  margin: 10px 10px 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-well);
  border: 1px solid var(--border-light);
  box-shadow: inset 0 1px 4px rgba(15, 23, 42, 0.08);
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
  color: var(--ink-muted);
  font-size: 12px;
}

.glass-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.14) 0%, transparent 38%);
  pointer-events: none;
}

.portrait-badges {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: flex;
  gap: 5px;
}

.glass-pill {
  color: #ffffff;
  background: rgba(15, 23, 42, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(6px);
}

.floating-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 5px;
}

.glass-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(15, 23, 42, 0.62);
  color: #f8fafc;
  cursor: pointer;
  text-decoration: none;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.24);
  transition: transform 0.1s ease, background 0.15s ease;
}

.glass-btn:hover {
  background: rgba(15, 23, 42, 0.85);
  transform: scale(1.06);
}

.glass-btn.light-action {
  background: var(--surface-card);
  color: var(--ink-secondary);
  border-color: var(--border-mid);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1);
}

.glass-btn.light-action:hover {
  background: var(--surface-elevated);
  color: var(--ink-primary);
}

.glass-btn.starred,
.mini-tool-btn.starred,
.icon-action.starred {
  color: #f59f00;
}

/* Index Banner for Worldbook / Other */
.index-banner {
  position: relative;
  height: 88px;
  margin: 10px 10px 0;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-weight: 700;
  font-size: 14.5px;
  border: 1px solid transparent;
}

.banner-worldbook {
  color: var(--accent-mint-text);
  background: var(--accent-mint-soft);
  border-color: var(--accent-mint-border);
}

.banner-other {
  color: var(--accent-cobalt-text);
  background: var(--accent-cobalt-soft);
  border-color: var(--accent-cobalt-border);
}

/* Card Body */
.card-body {
  padding: 12px 14px 13px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1;
}

.card-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.paper-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 15.5px;
  font-weight: 700;
  color: var(--ink-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--ink-muted);
}

.folder-inline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.paper-summary {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.58;
  color: var(--ink-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 9px;
}

.paper-footer {
  border-top: 1px dashed var(--border-light);
}

.meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.mono-size {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-muted);
  white-space: nowrap;
}

/* Preset Modern Hardware Module */
.preset-card {
  padding: 14px;
  gap: 11px;
}

.hw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hw-left {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.hw-model {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--ink-muted);
}

.card-actions {
  display: flex;
  gap: 6px;
}

.mini-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  border-radius: 7px;
  border: 1px solid var(--border-mid);
  background: var(--surface-card);
  color: var(--ink-secondary);
  cursor: pointer;
  text-decoration: none;
  box-shadow: 0 1px 2px var(--btn-shadow-color);
  transition: all 0.12s ease;
}

.mini-tool-btn:hover {
  border-color: var(--border-strong);
  color: var(--ink-primary);
}

.hw-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 15.5px;
  font-weight: 700;
  color: var(--ink-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-lcd {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 10px;
  padding: 10px 12px;
}

.lcd-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lcd-k {
  font-size: 9.5px;
  color: #64748b;
  letter-spacing: 0.08em;
}

.lcd-v {
  font-size: 13.5px;
  font-weight: 600;
  color: #7dd3fc;
}

.hw-summary {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.hw-footer {
  border-top: 1px dashed var(--border-mid);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.hw-tag {
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--surface-card);
  border: 1px solid var(--border-mid);
  color: var(--ink-secondary);
}

/* Theme Swatch Board */
.theme-preview-window {
  position: relative;
  height: 128px;
  margin: 10px 10px 0;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  border: 1px solid var(--border-mid);
  box-shadow: inset 0 2px 8px rgba(15, 23, 42, 0.25);
  background-image: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.08), transparent 60%);
}

.mini-bubble {
  width: 100%;
  padding: 9px 11px;
  border-radius: 7px;
  border: 1px solid;
  font-size: 12px;
  line-height: 1.4;
  backdrop-filter: blur(8px);
}

.swatch-strip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px 0;
}

.swatch-chip {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--surface-card);
  box-shadow:
    0 0 0 1px var(--border-mid),
    0 2px 4px rgba(15, 23, 42, 0.16);
}

/* List View Row */
.list-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 11px 14px;
  cursor: pointer;
}

.list-thumb {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-well);
  color: var(--accent-cobalt);
  border: 1px solid var(--border-light);
}

.thumb-worldbook {
  background: var(--accent-mint-soft);
  color: var(--accent-mint);
}

.thumb-preset {
  background: #141a24;
  color: #7dd3fc;
}

.list-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.list-main {
  flex: 1;
  min-width: 0;
}

.list-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.list-title {
  font-weight: 700;
  font-size: 14.5px;
  color: var(--ink-primary);
}

.list-summary {
  margin-top: 3px;
  font-size: 12.5px;
  color: var(--ink-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--ink-muted);
}

.list-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid var(--border-light);
  background: var(--surface-subtle);
  color: var(--ink-secondary);
  cursor: pointer;
  text-decoration: none;
  transition: all 0.12s ease;
}

.icon-action:hover {
  background: var(--surface-well);
  border-color: var(--border-mid);
  color: var(--ink-primary);
}
</style>
