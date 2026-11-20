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
  { key: 'all', label: '全部档案', icon: Archive },
  { key: 'character', label: '角色卡', icon: UserSquare2 },
  { key: 'preset', label: '对话预设', icon: Sliders },
  { key: 'theme', label: '界面主题', icon: Palette },
  { key: 'worldbook', label: '世界书', icon: BookOpen },
  { key: 'other', label: '正则与扩展', icon: Puzzle },
];
</script>

<template>
  <aside class="rail-panel sidebar">
    <!-- Modern Architectural Studio Plaque -->
    <div class="studio-plaque nameplate">
      <span class="studio-pin-screw screw-tl"></span>
      <span class="studio-pin-screw screw-tr"></span>
      <span class="studio-pin-screw screw-bl"></span>
      <span class="studio-pin-screw screw-br"></span>
      <div class="plate-badge">
        <span class="plate-dot"></span>
        <span>ARCHIVE BOARD</span>
      </div>
      <div class="plate-title">TAVERN VAULT</div>
      <div class="plate-sub">酒馆档案墙 · 本地收藏库</div>
    </div>

    <!-- Category Index Tabs -->
    <div class="nav-section">
      <div class="section-label">档案分区</div>
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
      <div class="section-label">收藏分组</div>
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
      <div class="section-label">索引贴纸</div>
      <div class="tag-cloud">
        <button
          v-for="t in stats.tags.slice(0, 24)"
          :key="t.name"
          class="sticker-tag"
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
  width: 262px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 18px 16px 16px;
  gap: 18px;
  overflow-y: auto;
  z-index: 6;
}

.nameplate {
  padding: 14px 16px 13px;
  text-align: center;
}

.plate-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: #94a3b8;
  margin-bottom: 4px;
}

.plate-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-vermilion);
  box-shadow: 0 0 6px rgba(232, 89, 12, 0.75);
}

.plate-title {
  font-family: var(--font-sans);
  font-weight: 800;
  font-size: 15.5px;
  letter-spacing: 0.14em;
  color: #f8fafc;
}

.plate-sub {
  margin-top: 3px;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  letter-spacing: 0.06em;
}

.screw-tl,
.screw-tr,
.screw-bl,
.screw-br {
  position: absolute;
}
.screw-tl { top: 7px; left: 7px; }
.screw-tr { top: 7px; right: 7px; }
.screw-bl { bottom: 7px; left: 7px; }
.screw-br { bottom: 7px; right: 7px; }

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
  text-transform: uppercase;
  padding: 0 8px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8.5px 11px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-secondary);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.14s ease;
}

.nav-tab:hover {
  background: var(--surface-hover);
  color: var(--ink-primary);
}

.nav-tab.active {
  color: var(--accent-cobalt-text);
  background: var(--accent-cobalt-soft);
  border-color: var(--accent-cobalt-border);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(59, 91, 219, 0.08);
}

.nav-tab.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent-cobalt);
}

.fav-tab.active {
  color: var(--accent-vermilion-text);
  background: var(--accent-vermilion-soft);
  border-color: var(--accent-vermilion-border);
}

.fav-tab.active::before {
  background: var(--accent-vermilion);
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
  background: var(--surface-well);
  border: 1px solid var(--border-light);
  color: var(--ink-secondary);
}

.nav-tab.active .tab-count {
  color: #ffffff;
  background: var(--accent-cobalt);
  border-color: #2b44b8;
  font-weight: 600;
}

.fav-tab.active .tab-count {
  background: var(--accent-vermilion);
  border-color: #c2410c;
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

.sticker-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11.5px;
  color: var(--ink-secondary);
  background: var(--surface-card);
  border: 1px solid var(--border-mid);
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: all 0.12s ease;
}

.sticker-tag:hover {
  border-color: var(--border-strong);
  color: var(--ink-primary);
  transform: translateY(-1px);
}

.sticker-tag.active {
  color: #ffffff;
  background: var(--accent-cobalt);
  border-color: #2b44b8;
  font-weight: 600;
}

.sticker-tag small {
  opacity: 0.72;
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
  color: var(--ink-secondary);
}

.gauge-value {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--ink-primary);
}

.gauge-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--ink-muted);
}
</style>
