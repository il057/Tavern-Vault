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
  all: '全部典藏',
  character: '角色卡典藏',
  preset: '对话预设库',
  theme: '界面主题库',
  worldbook: '独立世界书',
  other: '正则与扩展',
};

const activeTitle = computed(() => {
  if (onlyFavorites.value) return '星标珍藏';
  if (activeFolder.value) return `抽屉：${activeFolder.value}`;
  if (activeTag.value) return `标签：#${activeTag.value}`;
  return categoryTitles[activeCategory.value] || '全部典藏';
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
  <div class="vault-shell wood-desk">
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
          抽屉：{{ activeFolder }}
          <button @click="activeFolder = ''"><X :size="12" /></button>
        </span>
        <span v-if="activeTag" class="active-chip">
          标签：#{{ activeTag }}
          <button @click="activeTag = ''"><X :size="12" /></button>
        </span>
      </div>

      <!-- Vault Shelf Content -->
      <section class="shelf-scroll">
        <div v-if="loading && items.length === 0" class="empty-well">
          <p>正在开启典藏柜…</p>
        </div>

        <div v-else-if="items.length === 0" class="empty-well">
          <div class="empty-plaque">
            <h3>典藏柜中尚无匹配档案</h3>
            <p>支持直接导入 SillyTavern 角色卡（.png / .json）、对话预设、界面主题、世界书及正则脚本。</p>
            <button class="skeuo-btn skeuo-btn-brass" @click="uploadOpen = true">
              <Upload :size="15" />
              <span>立即导入第一份档案</span>
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
  padding: 10px 24px 0;
}

.active-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #2b1a06;
  background: linear-gradient(180deg, #f2d599 0%, #c89648 100%);
  border: 1px solid #7d561d;
  font-weight: 600;
}

.active-chip button {
  border: none;
  background: transparent;
  color: inherit;
  display: inline-flex;
  cursor: pointer;
  padding: 0;
}

.shelf-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 22px 24px 40px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 20px;
  align-items: stretch;
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 1100px;
}

.empty-well {
  height: 100%;
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-plaque {
  max-width: 440px;
  padding: 32px 28px;
  text-align: center;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(48, 35, 28, 0.9) 0%, rgba(30, 22, 17, 0.95) 100%);
  border: 1px solid #594434;
  box-shadow:
    inset 0 1px 0 rgba(255, 236, 204, 0.14),
    0 16px 40px rgba(0, 0, 0, 0.55);
}

.empty-plaque h3 {
  margin: 0 0 8px;
  font-family: var(--font-serif);
  font-size: 19px;
  color: #f3e4c9;
}

.empty-plaque p {
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.65;
  color: #b7a38e;
}

@media (max-width: 820px) {
  .vault-shell {
    flex-direction: column;
  }
}
</style>
