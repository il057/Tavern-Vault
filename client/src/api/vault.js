const API_BASE = '/api';

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function fetchStats() {
  return handleJson(await fetch(`${API_BASE}/stats`));
}

export async function fetchItems(params = {}, { signal } = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  return handleJson(await fetch(`${API_BASE}/items?${qs.toString()}`, { signal }));
}

export async function fetchItemDetail(id) {
  return handleJson(await fetch(`${API_BASE}/items/${encodeURIComponent(id)}`));
}

export async function fetchItemRaw(id) {
  return handleJson(await fetch(`${API_BASE}/items/${encodeURIComponent(id)}/raw`));
}

export async function uploadFiles(files, { category = 'auto', folder = '', tags = '' } = {}) {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  form.append('category', category);
  if (folder) form.append('folder', folder);
  if (tags) form.append('tags', tags);

  return handleJson(
    await fetch(`${API_BASE}/items/upload`, {
      method: 'POST',
      body: form,
    })
  );
}

export async function updateItem(id, patch) {
  return handleJson(
    await fetch(`${API_BASE}/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  );
}

export async function uploadCover(id, file) {
  const form = new FormData();
  form.append('cover', file);
  return handleJson(
    await fetch(`${API_BASE}/items/${encodeURIComponent(id)}/cover`, {
      method: 'POST',
      body: form,
    })
  );
}

export async function deleteItem(id) {
  return handleJson(
    await fetch(`${API_BASE}/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  );
}

export function getDownloadUrl(id) {
  return `${API_BASE}/items/${encodeURIComponent(id)}/download`;
}

export function getExportJsonUrl(id) {
  return `${API_BASE}/items/${encodeURIComponent(id)}/export/json`;
}

export function getExportPngUrl(id) {
  return `${API_BASE}/items/${encodeURIComponent(id)}/export/png`;
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
