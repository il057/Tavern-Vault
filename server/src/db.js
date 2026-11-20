import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.VAULT_DATA_DIR
  ? path.resolve(process.env.VAULT_DATA_DIR)
  : path.resolve(__dirname, '../../data');

export const FILES_DIR = path.join(DATA_DIR, 'files');
export const COVERS_DIR = path.join(DATA_DIR, 'covers');

fs.mkdirSync(FILES_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'vault.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    creator TEXT DEFAULT '',
    version TEXT DEFAULT '',
    format TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    cover_path TEXT DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    summary TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    folder TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(favorite);
  CREATE INDEX IF NOT EXISTS idx_items_folder ON items(folder);
  CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
`);

export function serializeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    creator: row.creator || '',
    version: row.version || '',
    format: row.format,
    original_filename: row.original_filename,
    file_size: row.file_size,
    summary: row.summary || '',
    notes: row.notes || '',
    folder: row.folder || '',
    tags: safeJsonParse(row.tags, []),
    metadata: safeJsonParse(row.metadata, {}),
    favorite: Boolean(row.favorite),
    has_cover: Boolean(row.cover_path),
    cover_url: row.cover_path ? `/api/items/${row.id}/cover?v=${encodeURIComponent(row.updated_at)}` : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
