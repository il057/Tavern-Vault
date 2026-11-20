<script setup>
import {
  Archive,
  UserSquare2,
  Sliders,
  Palette,
  BookOpen,
  Puzzle,
  Star,
  Folder,
  Tag,
  HardDrive,
} from 'lucide-vue-next';
import { formatBytes } from '../api/vault.js';

defineProps({
  stats: { type: Object, required: true },
  activeCategory: { type: String, required: true },
  onlyFavorites: { type: Boolean, default: false },
  activeFolder: { type: String, default: '' },
  activeTag: { type: String, default: '' },
});

const emit = defineEmits(['select-category', 'toggle-favorites', 'select-folder', 'select-tag']);

const navItems = [
  { key: 'all', label: '全部典藏', icon: Archive },
  { key: 'character', label: '角色卡', icon: UserSquare2 },
  { key: 'preset', label: '对话预设', icon: Sliders },
  { key: 'theme', label: '界面主题', icon: Palette },
  { key: 'worldbook', label: '世界书', icon: BookOpen },
  { key: 'other', label: '正则与扩展', icon: Puzzle },
];
</script>

<template>
  <aside class="leather-panel sidebar">
    <!-- Brushed Brass Nameplate -->
    <div class="brass-plate nameplate">
      <span class="brass-rivet rivet-tl"></span>
      <span class="brass-rivet rivet-tr"></span>
      <span class="brass-rivet rivet-bl"></span>
      <span class="brass-rivet rivet-br"></span>
      <div class="plate-title">TAVERN VAULT</div>
      <div class="plate-sub">酒馆典藏柜 · 本地档案库</div>
    </div>

    <!-- Category Index Tabs -->
    <div class="nav-section">
      <div class="section-label">典藏分类</div>
      <nav class="nav-list">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-tab"
          :class="{ active: !onlyFavorites && activeCategory === item.key && !activeFolder && !activeTag }"
          @click="emit('select-category', item.key)"
        >
          <span class="tab-left">
            <component :is="item.icon" :size="16" />
            <span>{{ item.label }}</span>
          </span>
          <span class="tab-count">{{ stats.counts?.[item.key] ?? 0 }}</span>
        </button>

        <button
          class="nav-tab fav-tab"
          :class="{ active: onlyFavorites }"
          @click="emit('toggle-favorites')"
        >
          <span class="tab-left">
            <Star :size="16" :fill="onlyFavorites ? 'currentColor' : 'none'" />
            <span>星标珍藏</span>
          </span>
          <span class="tab-count">{{ stats.counts?.favorite ?? 0 }}</span>
        </button>
      </nav>
    </div>

    <!-- Folders / Collections -->
    <div v-if="stats.folders && stats.folders.length" class="nav-section">
      <div class="section-label">档案抽屉</div>
      <div class="nav-list">
        <button
          v-for="f in stats.folders"
          :key="f.name"
          class="nav-tab small-tab"
          :class="{ active: activeFolder === f.name }"
          @click="emit('select-folder', activeFolder === f.name ? '' : f.name)"
        >
          <span class="tab-left">
            <Folder :size="14" />
            <span class="truncate">{{ f.name }}</span>
          </span>
          <span class="tab-count">{{ f.count }}</span>
        </button>
      </div>
    </div>

    <!-- Tags -->
    <div v-if="stats.tags && stats.tags.length" class="nav-section tags-section">
      <div class="section-label">索引标签</div>
      <div class="tag-cloud">
        <button
          v-for="t in stats.tags.slice(0, 24)"
          :key="t.name"
          class="leather-tag"
          :class="{ active: activeTag === t.name }"
          @click="emit('select-tag', activeTag === t.name ? '' : t.name)"
        >
          <Tag :size="11" />
          <span>{{ t.name }}</span>
          <small>{{ t.count }}</small>
        </button>
      </div>
    </div>

    <!-- Bottom Storage Gauge -->
    <div class="storage-gauge recessed-well">
      <div class="gauge-row">
        <span class="gauge-label">
          <HardDrive :size="13" />
          本地库容量
        </span>
        <span class="gauge-value">{{ formatBytes(stats.totalSize) }}</span>
      </div>
      <div class="gauge-meta">
        <span class="led-dot led-green"></span>
        <span>SQLite 本地归档 · {{ stats.counts?.all ?? 0 }} 份档案</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 18px 18px;
  gap: 18px;
  overflow-y: auto;
  z-index: 2;
}

.nameplate {
  padding: 14px 16px;
  text-align: center;
}

.plate-title {
  font-family: var(--font-serif);
  font-weight: 900;
  font-size: 16px;
  letter-spacing: 0.14em;
}

.plate-sub {
  margin-top: 3px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.82;
  letter-spacing: 0.08em;
}

.rivet-tl,
.rivet-tr,
.rivet-bl,
.rivet-br {
  position: absolute;
}
.rivet-tl { top: 6px; left: 6px; }
.rivet-tr { top: 6px; right: 6px; }
.rivet-bl { bottom: 6px; left: 6px; }
.rivet-br { bottom: 6px; right: 6px; }

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #a9927a;
  text-transform: uppercase;
  padding: 0 6px;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.7);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nav-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: #d9cbb9;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.14s ease;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.65);
}

.nav-tab:hover {
  background: rgba(255, 232, 198, 0.06);
  border-color: rgba(255, 232, 198, 0.08);
  color: #fff6ea;
}

.nav-tab.active {
  color: #f6dfad;
  background: linear-gradient(180deg, #1b130f 0%, #261b15 100%);
  border: 1px solid #0f0a08;
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.75),
    0 1px 0 rgba(255, 232, 198, 0.14);
}

.small-tab {
  padding: 7px 10px;
  font-size: 12.5px;
}

.tab-left {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-count {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 232, 198, 0.12);
  color: #c9b59c;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.nav-tab.active .tab-count {
  color: #2c1a06;
  background: linear-gradient(180deg, #efd297 0%, #c8974b 100%);
  border-color: #6b4917;
  box-shadow: inset 0 1px 0 rgba(255, 250, 230, 0.75);
  font-weight: 700;
}

.tags-section {
  flex: 1;
  min-height: 0;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.leather-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11.5px;
  color: #d6c4ae;
  background: linear-gradient(180deg, #3c2e25 0%, #2c211b 100%);
  border: 1px solid #16100c;
  border-radius: 6px;
  box-shadow:
    inset 0 1px 0 rgba(255, 234, 200, 0.16),
    0 2px 3px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  transition: all 0.12s ease;
}

.leather-tag:hover {
  filter: brightness(1.12);
}

.leather-tag.active {
  color: #2b1a06;
  background: linear-gradient(180deg, #f2d599 0%, #c89648 100%);
  border-color: #6b4917;
  font-weight: 600;
}

.leather-tag small {
  opacity: 0.7;
  font-family: var(--font-mono);
  font-size: 10px;
}

.storage-gauge {
  margin-top: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gauge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.gauge-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #b7a38e;
}

.gauge-value {
  font-family: var(--font-mono);
  font-weight: 600;
  color: #f0d399;
}

.gauge-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: #93806e;
}
</style>
