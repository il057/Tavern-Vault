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
import LiquidGlass from './components/LiquidGlass.vue';

const stats = ref({
        counts: { all: 0, character: 0, preset: 0, theme: 0, worldbook: 0, other: 0, favorite: 0 },
        totalSize: 0,
        tags: [],
        folders: [],
});

const items = ref([]);
const loading = ref(false);

const VALID_SORTS = new Set([
        'created_desc',
        'created_asc',
        'updated_desc',
        'name_asc',
        'name_desc',
        'size_desc',
        'size_asc',
]);

function readSavedSort() {
        try {
                const saved = localStorage.getItem('tavern-vault-sort');
                return saved && VALID_SORTS.has(saved) ? saved : 'created_desc';
        } catch {
                return 'created_desc';
        }
}

function readSavedPinFavorites() {
        try {
                const saved = localStorage.getItem('tavern-vault-pin-favorites');
                return saved === null ? true : saved !== 'false';
        } catch {
                return true;
        }
}

const activeCategory = ref('all');
const onlyFavorites = ref(false);
const activeFolder = ref('');
const activeTag = ref('');
const search = ref('');
const sort = ref(readSavedSort());
const pinFavorites = ref(readSavedPinFavorites());
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
                                favorite_first: pinFavorites.value ? 'true' : 'false',
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
watch(sort, (val) => {
        try {
                localStorage.setItem('tavern-vault-sort', val);
        } catch {
                // ignore storage errors
        }
});

watch(pinFavorites, (val) => {
        try {
                localStorage.setItem('tavern-vault-pin-favorites', String(val));
        } catch {
                // ignore storage errors
        }
});

watch([activeCategory, onlyFavorites, activeFolder, activeTag, sort, pinFavorites], () => {
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
                await updateItem(item.id, { favorite: !item.favorite });
                await loadAll();
        } catch (err) {
                notify({ type: 'error', text: err.message });
        }
}

function handleUploaded(res) {
        const okCount = res.created?.length || 0;
        const skipCount = res.skipped?.length || 0;
        const errCount = res.errors?.length || 0;
        if (okCount > 0) {
                const extras = [];
                if (skipCount) extras.push(`跳过 ${skipCount} 份重复`);
                if (errCount) extras.push(`${errCount} 份解析失败`);
                notify({
                        type: 'success',
                        text: `成功归档 ${okCount} 份档案${extras.length ? `（${extras.join('，')}）` : ''}`,
                });
        } else if (skipCount > 0) {
                notify({
                        type: 'success',
                        text: `检测到 ${skipCount} 份完全相同的档案，已跳过重复导入${errCount ? `（${errCount} 份解析失败）` : ''}`,
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
                <SidebarNav :stats="stats" :active-category="activeCategory" :only-favorites="onlyFavorites"
                        :active-folder="activeFolder" :active-tag="activeTag" @select-category="selectCategory"
                        @toggle-favorites="toggleFavorites" @select-folder="selectFolder" @select-tag="selectTag" />

                <main class="vault-main">
                        <!-- Floating Liquid Glass Bar -->
                        <div class="floating-console-wrap">
                                <TopConsole v-model:search="search" v-model:sort="sort"
                                        v-model:pin-favorites="pinFavorites" v-model:view-mode="viewMode"
                                        :total-shown="items.length" :active-title="activeTitle"
                                        @open-upload="uploadOpen = true" />
                        </div>

                        <!-- Scrollable Archive Content (passes beneath floating glass bar) -->
                        <section class="board-scroll">
                                <!-- Active Filter Bar -->
                                <div v-if="activeFolder || activeTag" class="filter-strip">
                                        <span v-if="activeFolder" class="active-chip">
                                                分组：{{ activeFolder }}
                                                <button aria-label="清除分组筛选" @click="activeFolder = ''">
                                                        <X :size="12" />
                                                </button>
                                        </span>
                                        <span v-if="activeTag" class="active-chip">
                                                标签：#{{ activeTag }}
                                                <button aria-label="清除标签筛选" @click="activeTag = ''">
                                                        <X :size="12" />
                                                </button>
                                        </span>
                                </div>

                                <div v-if="loading && items.length === 0" class="empty-well">
                                        <p class="loading-text">正在整理档案库…</p>
                                </div>

                                <div v-else-if="items.length === 0" class="empty-well">
                                        <LiquidGlass variant="clear" :radius="28" :bezel-width="24" :blur="2"
                                                :saturate="1.4" :dispersion="true" class="empty-plaque">
                                                <div class="empty-plaque-inner">
                                                        <h3>尚未找到匹配的档案</h3>
                                                        <p>支持直接导入 SillyTavern 角色卡（.png / .json）、对话预设、界面主题、世界书及正则脚本。</p>
                                                        <button class="glass-pill-btn glass-btn-primary"
                                                                @click="uploadOpen = true">
                                                                <Upload :size="16" />
                                                                <span>立即导入第一份档案</span>
                                                        </button>
                                                </div>
                                        </LiquidGlass>
                                </div>

                                <div v-else :class="viewMode === 'grid' ? 'cards-grid' : 'cards-list'">
                                        <ItemCard v-for="it in items" :key="it.id" :item="it" :view-mode="viewMode"
                                                @open="selectedItemId = $event.id"
                                                @toggle-favorite="handleToggleFavorite" />
                                </div>
                        </section>
                </main>

                <UploadModal :open="uploadOpen" @close="uploadOpen = false" @uploaded="handleUploaded" />

                <DetailDrawer :item-id="selectedItemId" @close="selectedItemId = null" @updated="handleItemUpdated"
                        @deleted="handleItemDeleted" @notify="notify" />

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
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
}

.floating-console-wrap {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 20;
        padding: var(--spacing-16) var(--spacing-24) 0 var(--spacing-16);
        pointer-events: none;
}

.floating-console-wrap>* {
        pointer-events: auto;
}

.board-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 96px var(--spacing-24) var(--spacing-48) var(--spacing-16);
}

.filter-strip {
        display: flex;
        align-items: center;
        gap: var(--spacing-8);
        margin-bottom: var(--spacing-16);
}

.active-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 32px;
        padding: 0 12px;
        border-radius: var(--radius-pill);
        font-size: var(--text-label);
        font-weight: var(--font-weight-medium);
        color: #ffffff;
        background: linear-gradient(180deg, rgba(59, 130, 246, 0.86) 0%, rgba(37, 99, 235, 0.9) 100%);
        border: 1px solid rgba(255, 255, 255, 0.45);
        box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.48),
                0 4px 14px rgba(37, 99, 235, 0.28);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
}

:root[data-theme='dark'] .active-chip {
        color: #ffffff;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.12) 100%);
        border-color: rgba(255, 255, 255, 0.34);
        box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.35),
                0 4px 14px rgba(0, 0, 0, 0.3);
}

.active-chip button {
        border: none;
        background: transparent;
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 2px;
        border-radius: 50%;
        opacity: 0.85;
}

.active-chip button:hover {
        opacity: 1;
}

.cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--spacing-24);
        align-items: stretch;
}

.cards-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-12);
        width: 100%;
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
        font-size: var(--text-body);
}

.empty-plaque {
        max-width: 440px;
        text-align: center;
        overflow: hidden;
        background: linear-gradient(
                155deg,
                rgba(30, 58, 95, 0.22) 0%,
                rgba(255, 255, 255, 0.16) 52%,
                rgba(30, 58, 95, 0.18) 100%
        ) !important;
}

:root[data-theme='dark'] .empty-plaque {
        background: var(--lg-surface-bg) !important;
}

.empty-plaque-inner {
        position: relative;
        z-index: 4;
        padding: var(--spacing-32) var(--spacing-24);
}

.empty-plaque h3 {
        margin: 0 0 var(--spacing-8);
        font-size: var(--text-subheading);
        font-weight: var(--font-weight-semibold);
        color: var(--ink-primary);
}

.empty-plaque p {
        margin: 0 0 var(--spacing-24);
        font-size: var(--text-body);
        line-height: var(--leading-body);
        color: var(--ink-secondary);
}

@media (max-width: 820px) {
        .vault-shell {
                flex-direction: column;
        }

        .floating-console-wrap {
                padding: var(--spacing-12) var(--spacing-16) 0;
        }

        .board-scroll {
                padding: 132px var(--spacing-16) calc(var(--spacing-32) + env(safe-area-inset-bottom, 0px));
        }
}
</style>
