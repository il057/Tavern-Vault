<script setup>
import { Search, X, Upload, LayoutGrid, List, ArrowUpDown } from 'lucide-vue-next';

defineProps({
  search: { type: String, default: '' },
  sort: { type: String, default: 'updated_desc' },
  viewMode: { type: String, default: 'grid' },
  totalShown: { type: Number, default: 0 },
  activeTitle: { type: String, default: '全部典藏' },
});

const emit = defineEmits(['update:search', 'update:sort', 'update:viewMode', 'open-upload']);
</script>

<template>
  <header class="console-bar top-console">
    <div class="console-left">
      <div class="title-block">
        <h1 class="console-title">{{ activeTitle }}</h1>
        <span class="count-pill">{{ totalShown }} 项</span>
      </div>

      <!-- Recessed Search Well -->
      <div class="recessed-well search-well">
        <Search :size="15" class="search-icon" />
        <input
          type="text"
          :value="search"
          placeholder="搜索名称、作者、标签、备注或文件名…"
          class="search-input"
          @input="emit('update:search', $event.target.value)"
        />
        <button v-if="search" class="clear-btn" title="清除搜索" @click="emit('update:search', '')">
          <X :size="14" />
        </button>
      </div>
    </div>

    <div class="console-right">
      <!-- Sort Selector -->
      <div class="recessed-well sort-well">
        <ArrowUpDown :size="13" class="sort-icon" />
        <select :value="sort" class="sort-select" @change="emit('update:sort', $event.target.value)">
          <option value="updated_desc">最近更新</option>
          <option value="created_desc">最新入库</option>
          <option value="name_asc">名称 A-Z</option>
          <option value="size_desc">体积从大到小</option>
        </select>
      </div>

      <!-- View Rocker Switch -->
      <div class="rocker-group" role="group" aria-label="视图切换">
        <button
          class="rocker-btn"
          :class="{ active: viewMode === 'grid' }"
          title="卡片陈列视图"
          @click="emit('update:viewMode', 'grid')"
        >
          <LayoutGrid :size="14" />
        </button>
        <button
          class="rocker-btn"
          :class="{ active: viewMode === 'list' }"
          title="档案目录视图"
          @click="emit('update:viewMode', 'list')"
        >
          <List :size="14" />
        </button>
      </div>

      <!-- Brushed Brass Import Button -->
      <button class="skeuo-btn skeuo-btn-brass import-btn" @click="emit('open-upload')">
        <Upload :size="15" />
        <span>导入档案</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-console {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  flex-wrap: wrap;
  z-index: 5;
}

.console-left {
  display: flex;
  align-items: center;
  gap: 18px;
  flex: 1;
  min-width: 260px;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.console-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 700;
  color: #f4e6cf;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.8);
}

.count-pill {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(255, 232, 198, 0.14);
  color: #d7be96;
}

.search-well {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 38px;
  flex: 1;
  max-width: 440px;
}

.search-icon {
  color: #9e8a74;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #f4eadb;
  font-size: 13px;
}

.search-input::placeholder {
  color: #7d6b59;
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #ccb8a0;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.console-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sort-well {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 36px;
}

.sort-icon {
  color: #a9927a;
}

.sort-select {
  border: none;
  outline: none;
  background: transparent;
  color: #ebd9c1;
  font-size: 12.5px;
  cursor: pointer;
}

.sort-select option {
  background: #231914;
  color: #f3e8d8;
}

.import-btn {
  height: 36px;
  padding: 0 16px;
}
</style>
