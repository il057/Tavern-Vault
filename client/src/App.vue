<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Upload, X } from 'lucide-vue-next';
import { fetchStats, fetchItems, updateItem } from './api/vault.js';
import SidebarNav from './components/SidebarNav.vue';
import TopConsole from './components/TopConsole.vue';
import ItemCard from './components/ItemCard.vue';
import UploadModal from './components/UploadModal.vue';
import DetailDrawer from './components/DetailDrawer.vue';
import ToastRack from './components/ToastRack.vue';

const stats = ref({
  counts: { all: 0, character: 0, preset: 0, theme: 0, worldbook: 0, other: 0, favorite: 0 },
  totalSize: 0,
  tags: [],
  folders: [],
});

const items = ref([]);
const loading = ref(false);

const activeCategory = ref('all');
const onlyFavorites = ref(false);
const activeFolder = ref('');
const activeTag = ref('');
const search = ref('');
const sort = ref('updated_desc');
const viewMode = ref('grid');

const uploadOpen = ref(false);
const selectedItemId = ref(null);
const toasts = ref([]);

const categoryTitles = {
  all: '全部档案',
  character: '角色卡墙',
  preset: '对话预设库',
  theme: '界面主题色卡',
  worldbook: '独立世界书',
  other: '正则与扩展',
};

const activeTitle = computed(() => {
  if (onlyFavorites.value) return '星标珍藏';
  if (activeFolder.value) return `分组：${activeFolder.value}`;
  if (activeTag.value) return `标签：#${activeTag.value}`;
  return categoryTitles[activeCategory.value] || '全部档案';
});

function notify({ type = 'success', text }) {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, type, text });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 3200);
}

async function loadAll() {
  loading.value = true;
  try {
    const [s, list] = await Promise.all([
      fetchStats(),
      fetchItems({
        category: onlyFavorites.value ? 'all' : activeCategory.value,
        favorite: onlyFavorites.value ? 'true' : '',
        folder: activeFolder.value,
        tag: activeTag.value,
        q: search.value,
        sort: sort.value,
      }),
    ]);
    stats.value = s;
    items.value = list.items || [];
  } catch (err) {
    notify({ type: 'error', text: err.message || '加载仓库数据失败' });
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;
watch([activeCategory, onlyFavorites, activeFolder, activeTag, sort], () => {
  loadAll();
});

watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadAll();
  }, 180);
});

onMounted(loadAll);

function selectCategory(cat) {
  onlyFavorites.value = false;
  activeFolder.value = '';
  activeTag.value = '';
  activeCategory.value = cat;
}

function toggleFavorites() {
  onlyFavorites.value = !onlyFavorites.value;
  if (onlyFavorites.value) {
    activeFolder.value = '';
    activeTag.value = '';
  }
}

function selectFolder(folder) {
  onlyFavorites.value = false;
  activeTag.value = '';
  activeCategory.value = 'all';
  activeFolder.value = folder;
}

function selectTag(tag) {
  onlyFavorites.value = false;
  activeFolder.value = '';
  activeTag.value = tag;
}

async function handleToggleFavorite(item) {
  try {
    const res = await updateItem(item.id, { favorite: !item.favorite });
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx !== -1) items.value[idx] = res.item;
    stats.value = await fetchStats();
  } catch (err) {
    notify({ type: 'error', text: err.message });
  }
}

function handleUploaded(res) {
  const okCount = res.created?.length || 0;
  const errCount = res.errors?.length || 0;
  if (okCount > 0) {
    notify({
      type: 'success',
      text: `成功归档 ${okCount} 份档案${errCount ? `（${errCount} 份解析失败）` : ''}`,
    });
  }
  loadAll();
}

function handleItemUpdated() {
  loadAll();
}

function handleItemDeleted() {
  notify({ type: 'success', text: '档案已从本地仓库移除' });
  loadAll();
}
</script>

<template>
  <div class="vault-shell board-canvas">
    <SidebarNav
      :stats="stats"
      :active-category="activeCategory"
      :only-favorites="onlyFavorites"
      :active-folder="activeFolder"
      :active-tag="activeTag"
      @select-category="selectCategory"
      @toggle-favorites="toggleFavorites"
      @select-folder="selectFolder"
      @select-tag="selectTag"
    />

    <main class="vault-main">
      <TopConsole
        v-model:search="search"
        v-model:sort="sort"
        v-model:view-mode="viewMode"
        :total-shown="items.length"
        :active-title="activeTitle"
        @open-upload="uploadOpen = true"
      />

      <!-- Active Filter Bar -->
      <div v-if="activeFolder || activeTag" class="filter-strip">
        <span v-if="activeFolder" class="active-chip">
          分组：{{ activeFolder }}
          <button @click="activeFolder = ''"><X :size="12" /></button>
        </span>
        <span v-if="activeTag" class="active-chip">
          标签：#{{ activeTag }}
          <button @click="activeTag = ''"><X :size="12" /></button>
        </span>
      </div>

      <!-- Bulletin Board Content -->
      <section class="board-scroll">
        <div v-if="loading && items.length === 0" class="empty-well">
          <p class="loading-text">正在整理档案公告板…</p>
        </div>

        <div v-else-if="items.length === 0" class="empty-well">
          <div class="empty-plaque paper-card">
            <span class="pin-magnet pin-cobalt"></span>
            <h3>公告板上尚无匹配档案</h3>
            <p>支持直接导入 SillyTavern 角色卡（.png / .json）、对话预设、界面主题、世界书及正则脚本。</p>
            <button class="skeuo-btn skeuo-btn-primary" @click="uploadOpen = true">
              <Upload :size="15" />
              <span>立即贴入第一份档案</span>
            </button>
          </div>
        </div>

        <div v-else :class="viewMode === 'grid' ? 'cards-grid' : 'cards-list'">
          <ItemCard
            v-for="it in items"
            :key="it.id"
            :item="it"
            :view-mode="viewMode"
            @open="selectedItemId = $event.id"
            @toggle-favorite="handleToggleFavorite"
          />
        </div>
      </section>
    </main>

    <UploadModal :open="uploadOpen" @close="uploadOpen = false" @uploaded="handleUploaded" />

    <DetailDrawer
      :item-id="selectedItemId"
      @close="selectedItemId = null"
      @updated="handleItemUpdated"
      @deleted="handleItemDeleted"
      @notify="notify"
    />

    <ToastRack :toasts="toasts" />
  </div>
</template>

<style scoped>
.vault-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.vault-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.filter-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 26px 0;
}

.active-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 12px;
  color: #ffffff;
  background: var(--accent-cobalt);
  border: 1px solid #2b44b8;
  box-shadow: 0 2px 6px rgba(59, 91, 219, 0.22);
  font-weight: 600;
}

.active-chip button {
  border: none;
  background: transparent;
  color: inherit;
  display: inline-flex;
  cursor: pointer;
  padding: 0;
  opacity: 0.85;
}

.active-chip button:hover {
  opacity: 1;
}

.board-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 26px 26px 44px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
  gap: 24px 20px;
  align-items: stretch;
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 1120px;
}

.empty-well {
  height: 100%;
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text {
  color: var(--ink-secondary);
  font-size: 14px;
}

.empty-plaque {
  max-width: 440px;
  padding: 36px 30px 30px;
  text-align: center;
}

.empty-plaque:hover {
  transform: none;
}

.empty-plaque h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink-primary);
}

.empty-plaque p {
  margin: 0 0 22px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--ink-secondary);
}

@media (max-width: 820px) {
  .vault-shell {
    flex-direction: column;
  }
}
</style>
