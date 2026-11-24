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
import LiquidGlass from './LiquidGlass.vue';

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
  <div class="sidebar-float-wrap">
    <LiquidGlass
      tag="aside"
      variant="surface"
      :radius="28"
      :blur="10"
      :saturate="1.45"
      class="sidebar"
    >
      <div class="sidebar-inner">
        <!-- Minimal Typographic Brand Header -->
        <div class="brand-header">
          <div class="brand-kicker">ARCHIVE VAULT</div>
          <div class="brand-title">Tavern Vault</div>
          <div class="brand-sub">酒馆档案墙 · 本地收藏库</div>
        </div>

        <!-- Category Index Pills -->
        <div class="nav-section">
          <div class="section-label">档案分区</div>
          <nav class="nav-list" aria-label="档案分区">
            <button
              v-for="item in navItems"
              :key="item.key"
              type="button"
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
              type="button"
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
              type="button"
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
          <div class="section-label">标签索引</div>
          <div class="tag-cloud">
            <button
              v-for="t in stats.tags.slice(0, 24)"
              :key="t.name"
              type="button"
              class="tag-pill"
              :class="{ active: activeTag === t.name }"
              @click="emit('select-tag', activeTag === t.name ? '' : t.name)"
            >
              <Tag :size="11" />
              <span>{{ t.name }}</span>
              <small>{{ t.count }}</small>
            </button>
          </div>
        </div>

        <!-- Bottom Recessed Crystal Storage Well -->
        <div class="storage-well">
          <div class="gauge-row">
            <span class="gauge-label">
              <HardDrive :size="13" />
              本地库容量
            </span>
            <span class="gauge-value">{{ formatBytes(stats.totalSize) }}</span>
          </div>
          <div class="gauge-meta">
            <span class="status-dot active"></span>
            <span v-if="stats.totalFiles && stats.totalFiles > (stats.counts?.all ?? 0)">
              SQLite 归档 · {{ stats.counts?.all ?? 0 }} 张（含 {{ stats.totalFiles }} 个版本）
            </span>
            <span v-else>SQLite 本地归档 · {{ stats.counts?.all ?? 0 }} 份</span>
          </div>
        </div>
      </div>
    </LiquidGlass>
  </div>
</template>

<style scoped>
.sidebar-float-wrap {
  flex-shrink: 0;
  padding: var(--spacing-16) 0 var(--spacing-16) var(--spacing-16);
  display: flex;
  z-index: 15;
}

.sidebar {
  width: 264px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-inner {
  position: relative;
  z-index: 4;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px var(--spacing-16) var(--spacing-16);
  gap: 20px;
}

.brand-header {
  padding: var(--spacing-4) var(--spacing-8);
}

.brand-kicker {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.14em;
  color: var(--color-focus);
  margin-bottom: 4px;
}

.brand-title {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-semibold);
  font-size: 20px;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--ink-primary);
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.35);
}

:root[data-theme='dark'] .brand-title {
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.brand-sub {
  margin-top: 3px;
  font-size: var(--text-label);
  color: var(--ink-muted);
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  color: var(--ink-muted);
  text-transform: uppercase;
  padding: 0 var(--spacing-12);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.nav-tab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-secondary);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    transform var(--ease-spring),
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease,
    box-shadow 180ms ease;
}

.nav-tab:hover {
  background: rgba(255, 255, 255, 0.32);
  border-color: rgba(255, 255, 255, 0.48);
  color: var(--ink-primary);
}

:root[data-theme='dark'] .nav-tab:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.18);
}

.nav-tab:active {
  transform: scale(0.96);
  transition: transform var(--ease-press);
}

/* Unified Liquid Glass Active Pill */
.nav-tab.active {
  color: #ffffff;
  background: linear-gradient(
    180deg,
    rgba(59, 130, 246, 0.88) 0%,
    rgba(37, 99, 235, 0.92) 100%
  );
  border-color: rgba(255, 255, 255, 0.52);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.58),
    inset 0 -1px 0 rgba(255, 255, 255, 0.16),
    0 6px 18px rgba(37, 99, 235, 0.28);
}

:root[data-theme='dark'] .nav-tab.active {
  color: #ffffff;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
  border-color: rgba(255, 255, 255, 0.36);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.38),
    0 6px 18px rgba(0, 0, 0, 0.3);
}

.fav-tab.active {
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.92) 100%);
  border-color: rgba(255, 255, 255, 0.5);
  color: #ffffff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.52),
    0 6px 18px rgba(217, 119, 6, 0.28);
}

:root[data-theme='dark'] .fav-tab.active {
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.28) 0%, rgba(217, 119, 6, 0.18) 100%);
  border-color: rgba(251, 191, 36, 0.48);
  color: #fde68a;
}

.small-tab {
  min-height: 36px;
  font-size: 13px;
}

.tab-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
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
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.45);
  color: var(--ink-secondary);
}

:root[data-theme='dark'] .tab-count {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--ink-secondary);
}

.nav-tab.active .tab-count {
  color: inherit;
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.32);
}

.tags-section {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 10px;
  font-size: var(--text-label);
  color: var(--ink-secondary);
  background: rgba(255, 255, 255, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: var(--radius-pill);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
  cursor: pointer;
  transition:
    transform var(--ease-spring),
    border-color 140ms ease,
    color 140ms ease,
    background 140ms ease;
}

:root[data-theme='dark'] .tag-pill {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.tag-pill:hover {
  background: rgba(255, 255, 255, 0.52);
  border-color: rgba(255, 255, 255, 0.85);
  color: var(--ink-primary);
}

:root[data-theme='dark'] .tag-pill:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.32);
}

.tag-pill:active {
  transform: scale(0.96);
  transition: transform var(--ease-press);
}

.tag-pill.active {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.94) 100%);
  border-color: rgba(255, 255, 255, 0.45);
}

.tag-pill small {
  opacity: 0.72;
  font-family: var(--font-mono);
  font-size: 10px;
}

/* Recessed Liquid Glass Storage Well */
.storage-well {
  flex-shrink: 0;
  margin-top: auto;
  padding: 12px 14px;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(255, 255, 255, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    0 4px 14px rgba(15, 28, 52, 0.06);
}

:root[data-theme='dark'] .storage-well {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 4px 16px rgba(0, 0, 0, 0.22);
}

.gauge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
}

.gauge-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-secondary);
}

.gauge-value {
  font-family: var(--font-mono);
  font-weight: var(--font-weight-semibold);
  color: var(--ink-primary);
}

.gauge-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--ink-muted);
}

@media (max-width: 820px) {
  .sidebar-float-wrap {
    padding: 12px 16px 0;
  }

  .sidebar {
    width: 100%;
    height: auto;
    border-radius: 22px !important;
  }

  .sidebar-inner {
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px 12px;
    gap: 10px;
  }

  .brand-header,
  .section-label,
  .tags-section,
  .storage-well {
    display: none;
  }

  .nav-section {
    flex-direction: row;
  }

  .nav-list {
    flex-direction: row;
    gap: 6px;
  }

  .nav-tab {
    width: auto;
    white-space: nowrap;
  }
}
</style>
