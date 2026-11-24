<script setup>
import { Search, X, Upload, LayoutGrid, List, ArrowUpDown, Star, Sun, Moon, Monitor } from 'lucide-vue-next';
import { useTheme } from '../composables/useTheme.js';
import LiquidGlass from './LiquidGlass.vue';
import GlassDropdown from './GlassDropdown.vue';

const sortOptions = [
  { value: 'created_desc', label: '导入时间（最新）' },
  { value: 'created_asc', label: '导入时间（最早）' },
  { value: 'updated_desc', label: '最近更新' },
  { value: 'name_asc', label: '名称首字母 A-Z' },
  { value: 'name_desc', label: '名称首字母 Z-A' },
  { value: 'size_desc', label: '体积（大 → 小）' },
  { value: 'size_asc', label: '体积（小 → 大）' },
];

defineProps({
  search: { type: String, default: '' },
  sort: { type: String, default: 'created_desc' },
  pinFavorites: { type: Boolean, default: true },
  viewMode: { type: String, default: 'grid' },
  totalShown: { type: Number, default: 0 },
  activeTitle: { type: String, default: '全部档案' },
});

const emit = defineEmits(['update:search', 'update:sort', 'update:pinFavorites', 'update:viewMode', 'open-upload']);

const { themeMode, setThemeMode } = useTheme();
</script>

<template>
  <LiquidGlass
    tag="header"
    variant="clear"
    :radius="999"
    :bezel-width="22"
    :blur="4"
    :saturate="1.35"
    :refraction="true"
    :dispersion="false"
    class="top-console"
  >
    <div class="console-left">
      <div class="title-block">
        <h1 class="console-title">{{ activeTitle }}</h1>
        <span class="count-pill">{{ totalShown }}</span>
      </div>

      <!-- Clear Liquid Glass Search Field -->
      <div class="glass-search-field search-well">
        <Search :size="15" class="search-icon" />
        <input
          type="text"
          :value="search"
          placeholder="搜索名称、作者、标签或文件名…"
          class="search-input"
          aria-label="搜索档案"
          @input="emit('update:search', $event.target.value)"
        />
        <button
          v-if="search"
          type="button"
          class="clear-btn"
          title="清除搜索"
          aria-label="清除搜索"
          @click="emit('update:search', '')"
        >
          <X :size="13" />
        </button>
      </div>
    </div>

    <div class="console-right">
      <!-- Sort Selector + Favorite-First Toggle -->
      <div class="sort-cluster">
        <GlassDropdown
          :model-value="sort"
          :options="sortOptions"
          variant="header"
          aria-label="排序方式"
          @update:model-value="emit('update:sort', $event)"
        >
          <template #prefix>
            <ArrowUpDown :size="13" />
          </template>
        </GlassDropdown>

        <button
          type="button"
          class="pin-fav-btn"
          :class="{ active: pinFavorites }"
          :title="pinFavorites ? '星标最前：已开启（点击关闭）' : '星标最前：已关闭（点击开启）'"
          :aria-label="pinFavorites ? '关闭星标最前' : '开启星标最前'"
          :aria-pressed="pinFavorites"
          @click="emit('update:pinFavorites', !pinFavorites)"
        >
          <Star :size="14" :fill="pinFavorites ? 'currentColor' : 'none'" />
        </button>
      </div>

      <!-- Theme Mode Segmented Control -->
      <div class="segmented-group console-segmented" role="group" aria-label="日夜模式切换">
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: themeMode === 'system' }"
          title="跟随系统日夜模式"
          aria-label="跟随系统"
          @click="setThemeMode('system')"
        >
          <Monitor :size="14" />
        </button>
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: themeMode === 'light' }"
          title="浅色模式"
          aria-label="浅色模式"
          @click="setThemeMode('light')"
        >
          <Sun :size="14" />
        </button>
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: themeMode === 'dark' }"
          title="深色模式"
          aria-label="深色模式"
          @click="setThemeMode('dark')"
        >
          <Moon :size="14" />
        </button>
      </div>

      <!-- View Mode Segmented Control -->
      <div class="segmented-group console-segmented" role="group" aria-label="视图切换">
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: viewMode === 'grid' }"
          title="卡片视图"
          aria-label="卡片视图"
          @click="emit('update:viewMode', 'grid')"
        >
          <LayoutGrid :size="14" />
        </button>
        <button
          type="button"
          class="segmented-btn"
          :class="{ active: viewMode === 'list' }"
          title="列表视图"
          aria-label="列表视图"
          @click="emit('update:viewMode', 'list')"
        >
          <List :size="14" />
        </button>
      </div>

      <!-- Primary Capsule Import Action -->
      <button
        type="button"
        class="glass-pill-btn glass-btn-primary import-btn"
        @click="emit('open-upload')"
      >
        <Upload :size="15" />
        <span>导入档案</span>
      </button>
    </div>
  </LiquidGlass>
</template>

<style scoped>
.top-console {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-16);
  min-height: 62px;
  padding: 9px 14px 9px 22px;
  flex-wrap: wrap;
}

.console-left {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--spacing-16);
  flex: 1;
  min-width: 240px;
}

.title-block {
  display: flex;
  align-items: center;
  gap: var(--spacing-8);
  flex-shrink: 0;
}

.console-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-subheading);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-subheading);
  color: #ffffff;
  text-shadow: 0 1px 4px rgba(10, 22, 42, 0.36);
  letter-spacing: -0.015em;
}

.count-pill {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  font-weight: var(--font-weight-medium);
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.44);
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(10, 22, 42, 0.25);
}

/* Crisp on-sky legibility inside the clear liquid glass header */
.search-well {
  flex: 1;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.42);
  color: #ffffff;
}

.search-well:focus-within {
  background: rgba(255, 255, 255, 0.26);
  border-color: rgba(255, 255, 255, 0.82);
}

.search-icon {
  color: rgba(255, 255, 255, 0.82);
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: var(--text-body);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.72);
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  cursor: pointer;
  flex-shrink: 0;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.36);
}

.console-right {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--spacing-8);
  flex-wrap: wrap;
}

.sort-cluster {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pin-fav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.8);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    0 4px 12px rgba(10, 22, 42, 0.1);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform var(--ease-spring),
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 180ms ease;
}

.pin-fav-btn:hover {
  background: rgba(255, 255, 255, 0.26);
  border-color: rgba(255, 255, 255, 0.78);
  color: #ffffff;
}

.pin-fav-btn:active {
  transform: scale(0.95);
  transition: transform var(--ease-press);
}

.pin-fav-btn.active {
  color: #fde68a;
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.56) 0%, rgba(217, 119, 6, 0.62) 100%);
  border-color: rgba(253, 230, 138, 0.78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    0 4px 14px rgba(217, 119, 6, 0.28);
}

:root[data-theme='dark'] .pin-fav-btn.active {
  color: #fcd34d;
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.3) 0%, rgba(217, 119, 6, 0.2) 100%);
  border-color: rgba(251, 191, 36, 0.52);
}

.sort-well {
  min-height: 44px;
  padding: 0 13px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.42);
}

.sort-well:hover {
  background: rgba(255, 255, 255, 0.26);
  border-color: rgba(255, 255, 255, 0.72);
}

.sort-icon {
  color: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
}

.sort-select {
  border: none;
  outline: none;
  background: transparent;
  color: #ffffff;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.sort-select option {
  background: var(--surface-solid-content);
  color: var(--ink-primary);
}

.console-segmented {
  background: rgba(15, 28, 52, 0.22);
  border-color: rgba(255, 255, 255, 0.34);
}

.console-segmented .segmented-btn {
  color: rgba(255, 255, 255, 0.82);
}

.console-segmented .segmented-btn:hover {
  color: #ffffff;
}

.console-segmented .segmented-btn.active {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0.18) 100%);
  border-color: rgba(255, 255, 255, 0.68);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 4px 12px rgba(10, 22, 42, 0.18);
}

:root[data-theme='dark'] .console-segmented .segmented-btn.active {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.14) 100%);
  border-color: rgba(255, 255, 255, 0.42);
}

.import-btn {
  padding: 0 18px;
}

@media (max-width: 960px) {
  .top-console {
    border-radius: var(--radius-sheet) !important;
    padding: 10px 14px;
  }
}
</style>
