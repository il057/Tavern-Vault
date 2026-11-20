import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { db, FILES_DIR, COVERS_DIR, serializeRow } from '../db.js';
import { parseUploadedFile } from '../parsers/detect.js';
import { extractCharaFromPng, embedCharaIntoPng, isPngBuffer } from '../parsers/pngCard.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB per file
    files: 30,
  },
});

function fixFilenameEncoding(name) {
  if (!name) return 'untitled.json';
  // Multer v1/v2 often decodes multipart filename headers as latin1
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    // If decoding produced replacement chars, keep original
    if (decoded.includes('\uFFFD')) return name;
    return decoded;
  } catch {
    return name;
  }
}

function readItemJson(row) {
  const fullPath = path.join(FILES_DIR, row.file_path);
  const buf = fs.readFileSync(fullPath);
  if (row.format === 'png' || isPngBuffer(buf)) {
    const extracted = extractCharaFromPng(buf);
    return extracted ? extracted.data : null;
  }
  return JSON.parse(buf.toString('utf8'));
}

function normalizeEntries(entries) {
  if (!entries) return [];
  const arr = Array.isArray(entries) ? entries : Object.values(entries);
  return arr.map((e, idx) => ({
    uid: e.uid ?? e.id ?? idx,
    comment: e.comment || e.name || `词条 #${idx + 1}`,
    keys: Array.isArray(e.keys) ? e.keys : (Array.isArray(e.key) ? e.key : []),
    secondary_keys: Array.isArray(e.secondary_keys) ? e.secondary_keys : (Array.isArray(e.keysecondary) ? e.keysecondary : []),
    content: e.content || '',
    enabled: e.enabled !== undefined ? Boolean(e.enabled) : !Boolean(e.disable),
    constant: Boolean(e.constant),
    insertion_order: e.insertion_order ?? e.order ?? 0,
    position: e.position ?? '',
  }));
}

function buildDetailPayload(row, json) {
  if (!json) return null;

  if (row.category === 'character') {
    const d = json.data && typeof json.data === 'object' ? json.data : json;
    const wbEntries = normalizeEntries(d.character_book?.entries);
    const regexScripts = Array.isArray(d.extensions?.regex_scripts)
      ? d.extensions.regex_scripts.map((r, i) => ({
          id: r.id || i,
          scriptName: r.scriptName || `Regex #${i + 1}`,
          findRegex: r.findRegex || '',
          replaceString: r.replaceString || '',
          disabled: Boolean(r.disabled),
        }))
      : [];

    return {
      spec: json.spec || (json.data ? 'chara_card_v2' : 'chara_card_v1'),
      spec_version: json.spec_version || '',
      name: d.name || json.name || row.name,
      creator: d.creator || '',
      character_version: d.character_version || '',
      description: d.description || '',
      personality: d.personality || '',
      scenario: d.scenario || '',
      first_mes: d.first_mes || '',
      mes_example: d.mes_example || '',
      creator_notes: d.creator_notes || json.creatorcomment || '',
      system_prompt: d.system_prompt || '',
      post_history_instructions: d.post_history_instructions || '',
      alternate_greetings: Array.isArray(d.alternate_greetings) ? d.alternate_greetings : [],
      tags: Array.isArray(d.tags) ? d.tags : [],
      character_book: d.character_book
        ? {
            name: d.character_book.name || '',
            entries: wbEntries,
          }
        : null,
      regex_scripts: regexScripts,
      extension_keys: d.extensions && typeof d.extensions === 'object' ? Object.keys(d.extensions) : [],
    };
  }

  if (row.category === 'preset') {
    const prompts = Array.isArray(json.prompts) ? json.prompts : [];
    let orderMap = null;
    let orderIndex = new Map();
    if (Array.isArray(json.prompt_order) && json.prompt_order.length > 0) {
      const group = json.prompt_order.find((g) => g.character_id === 100001) || json.prompt_order[0];
      if (group && Array.isArray(group.order)) {
        orderMap = new Map(group.order.map((o) => [o.identifier, Boolean(o.enabled)]));
        group.order.forEach((o, i) => orderIndex.set(o.identifier, i));
      }
    }

    const mappedPrompts = prompts.map((p, idx) => ({
      identifier: p.identifier || `prompt_${idx}`,
      name: p.name || p.identifier || `未命名模块 #${idx + 1}`,
      role: p.role || 'system',
      enabled: orderMap && orderMap.has(p.identifier) ? orderMap.get(p.identifier) : Boolean(p.enabled),
      marker: Boolean(p.marker),
      system_prompt: Boolean(p.system_prompt),
      injection_position: p.injection_position ?? 0,
      injection_depth: p.injection_depth ?? 4,
      injection_order: p.injection_order ?? 100,
      content: p.content || '',
      _sort: orderIndex.has(p.identifier) ? orderIndex.get(p.identifier) : 100000 + idx,
    }));

    mappedPrompts.sort((a, b) => a._sort - b._sort);

    return {
      params: {
        temperature: json.temperature ?? json.temp ?? null,
        top_p: json.top_p ?? null,
        top_k: json.top_k ?? null,
        top_a: json.top_a ?? null,
        min_p: json.min_p ?? null,
        frequency_penalty: json.frequency_penalty ?? null,
        presence_penalty: json.presence_penalty ?? null,
        repetition_penalty: json.repetition_penalty ?? json.rep_pen ?? null,
        openai_max_context: json.openai_max_context ?? json.max_context ?? null,
        openai_max_tokens: json.openai_max_tokens ?? json.max_length ?? null,
        stream_openai: Boolean(json.stream_openai),
        show_thoughts: Boolean(json.show_thoughts),
        reasoning_effort: json.reasoning_effort ?? null,
        squash_system_messages: Boolean(json.squash_system_messages),
        wi_format: json.wi_format ?? '',
      },
      prompts: mappedPrompts.map(({ _sort, ...rest }) => rest),
    };
  }

  if (row.category === 'theme') {
    return {
      name: json.name || row.name,
      blur_strength: json.blur_strength ?? 0,
      chat_width: json.chat_width ?? 50,
      font_scale: json.font_scale ?? 1,
      shadow_width: json.shadow_width ?? 0,
      toastr_position: json.toastr_position || '',
      colors: {
        main_text_color: json.main_text_color || '',
        italics_text_color: json.italics_text_color || '',
        underline_text_color: json.underline_text_color || '',
        quote_text_color: json.quote_text_color || '',
        blur_tint_color: json.blur_tint_color || '',
        chat_tint_color: json.chat_tint_color || '',
        user_mes_blur_tint_color: json.user_mes_blur_tint_color || '',
        bot_mes_blur_tint_color: json.bot_mes_blur_tint_color || '',
        shadow_color: json.shadow_color || '',
        border_color: json.border_color || '',
      },
      toggles: {
        fast_ui_mode: Boolean(json.fast_ui_mode),
        waifuMode: Boolean(json.waifuMode),
        noShadows: Boolean(json.noShadows),
        timer_enabled: Boolean(json.timer_enabled),
        timestamps_enabled: Boolean(json.timestamps_enabled),
        mesIDDisplay_enabled: Boolean(json.mesIDDisplay_enabled),
        message_token_count_enabled: Boolean(json.message_token_count_enabled),
        hideChatAvatars_enabled: Boolean(json.hideChatAvatars_enabled),
        reduced_motion: Boolean(json.reduced_motion),
        compact_input_area: Boolean(json.compact_input_area),
      },
      custom_css: typeof json.custom_css === 'string' ? json.custom_css : '',
    };
  }

  if (row.category === 'worldbook') {
    return {
      name: json.name || row.name,
      entries: normalizeEntries(json.entries),
    };
  }

  return json;
}

// GET /api/stats
router.get('/stats', (_req, res) => {
  const rows = db.prepare('SELECT category, favorite, file_size, tags, folder FROM items').all();
  const counts = {
    all: rows.length,
    character: 0,
    preset: 0,
    theme: 0,
    worldbook: 0,
    other: 0,
    favorite: 0,
  };
  let totalSize = 0;
  const tagMap = new Map();
  const folderMap = new Map();

  for (const r of rows) {
    if (counts[r.category] !== undefined) counts[r.category]++;
    if (r.favorite) counts.favorite++;
    totalSize += r.file_size || 0;

    if (r.folder) {
      folderMap.set(r.folder, (folderMap.get(r.folder) || 0) + 1);
    }
    try {
      const tags = JSON.parse(r.tags || '[]');
      for (const t of tags) {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      }
    } catch {
      // ignore
    }
  }

  const tags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const folders = Array.from(folderMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ counts, totalSize, tags, folders });
});

// GET /api/items
router.get('/items', (req, res) => {
  const { category, favorite, folder, tag, q, sort = 'updated_desc' } = req.query;
  const conditions = [];
  const params = [];

  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }
  if (favorite === 'true' || favorite === '1') {
    conditions.push('favorite = 1');
  }
  if (folder) {
    conditions.push('folder = ?');
    params.push(folder);
  }

  let orderBy = 'updated_at DESC';
  if (sort === 'created_desc') orderBy = 'created_at DESC';
  else if (sort === 'name_asc') orderBy = 'name COLLATE NOCASE ASC';
  else if (sort === 'size_desc') orderBy = 'file_size DESC';

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM items ${whereSql} ORDER BY ${orderBy}`).all(...params);

  let items = rows.map(serializeRow);

  if (tag) {
    items = items.filter((item) => item.tags.includes(tag));
  }

  if (q && String(q).trim()) {
    const kw = String(q).trim().toLowerCase();
    items = items.filter((item) => {
      return (
        item.name.toLowerCase().includes(kw) ||
        item.creator.toLowerCase().includes(kw) ||
        item.summary.toLowerCase().includes(kw) ||
        item.notes.toLowerCase().includes(kw) ||
        item.original_filename.toLowerCase().includes(kw) ||
        item.folder.toLowerCase().includes(kw) ||
        item.tags.some((t) => t.toLowerCase().includes(kw))
      );
    });
  }

  res.json({ items });
});

// POST /api/items/upload
router.post('/items/upload', upload.array('files', 30), (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: '请选择至少一个文件上传' });
  }

  const categoryOverride = req.body.category && req.body.category !== 'auto' ? req.body.category : null;
  const folder = (req.body.folder || '').trim();
  const extraTags = (req.body.tags || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const created = [];
  const errors = [];

  const insertStmt = db.prepare(`
    INSERT INTO items (
      id, category, name, creator, version, format, original_filename,
      file_path, cover_path, file_size, summary, notes, folder, tags, metadata,
      favorite, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);

  for (const file of files) {
    const originalFilename = fixFilenameEncoding(file.originalname);
    try {
      const parsed = parseUploadedFile(file.buffer, originalFilename, categoryOverride);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const catDir = path.join(FILES_DIR, parsed.category);
      fs.mkdirSync(catDir, { recursive: true });

      const ext = parsed.format === 'png' ? '.png' : '.json';
      const relFilePath = path.join(parsed.category, `${id}${ext}`);
      fs.writeFileSync(path.join(FILES_DIR, relFilePath), file.buffer);

      let coverPath = '';
      if (parsed.isPngCard) {
        const coverFilename = `${id}.png`;
        fs.writeFileSync(path.join(COVERS_DIR, coverFilename), file.buffer);
        coverPath = coverFilename;
      }

      const mergedTags = Array.from(new Set([...(parsed.tags || []), ...extraTags]));

      insertStmt.run(
        id,
        parsed.category,
        parsed.name,
        parsed.creator || '',
        parsed.version || '',
        parsed.format,
        originalFilename,
        relFilePath,
        coverPath,
        file.buffer.length,
        parsed.summary || '',
        '',
        folder,
        JSON.stringify(mergedTags),
        JSON.stringify(parsed.metadata || {}),
        now,
        now
      );

      const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
      created.push(serializeRow(row));
    } catch (err) {
      errors.push({
        filename: originalFilename,
        error: err.message || '解析失败',
      });
    }
  }

  if (created.length === 0 && errors.length > 0) {
    return res.status(400).json({ error: errors[0].error, errors });
  }

  res.status(201).json({ created, errors });
});

// GET /api/items/:id
router.get('/items/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });

  let detail = null;
  try {
    const json = readItemJson(row);
    detail = buildDetailPayload(row, json);
  } catch (err) {
    detail = { parseError: err.message };
  }

  res.json({
    item: serializeRow(row),
    detail,
  });
});

// GET /api/items/:id/raw
router.get('/items/:id/raw', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });

  try {
    const json = readItemJson(row);
    res.json({ raw: json });
  } catch (err) {
    res.status(500).json({ error: err.message || '读取原始内容失败' });
  }
});

// GET /api/items/:id/download
router.get('/items/:id/download', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });

  const fullPath = path.join(FILES_DIR, row.file_path);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: '归档文件已丢失' });
  }

  const downloadName = row.original_filename || `${row.name}.${row.format}`;
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="archive.${row.format}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
  );
  res.sendFile(fullPath);
});

// GET /api/items/:id/export/json
router.get('/items/:id/export/json', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });

  try {
    const json = readItemJson(row);
    const filename = `${row.name}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export.json"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(JSON.stringify(json, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message || '导出 JSON 失败' });
  }
});

// GET /api/items/:id/export/png
router.get('/items/:id/export/png', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });
  if (row.category !== 'character') {
    return res.status(400).json({ error: '仅角色卡支持导出为 PNG 卡片' });
  }

  try {
    const fullPath = path.join(FILES_DIR, row.file_path);
    if (row.format === 'png') {
      const filename = `${row.name}.png`;
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="character.png"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      return res.sendFile(fullPath);
    }

    if (!row.cover_path) {
      return res.status(400).json({ error: '请先为该 JSON 角色卡上传一张 PNG 封面图，再导出为 PNG 角色卡' });
    }

    const coverFull = path.join(COVERS_DIR, row.cover_path);
    const coverBuf = fs.readFileSync(coverFull);
    if (!isPngBuffer(coverBuf)) {
      return res.status(400).json({ error: '当前封面不是 PNG 格式，请上传 PNG 格式封面后再导出为 PNG 角色卡' });
    }

    const cardJson = readItemJson(row);
    const outPng = embedCharaIntoPng(coverBuf, cardJson);
    const filename = `${row.name}.png`;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="character.png"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(outPng);
  } catch (err) {
    res.status(500).json({ error: err.message || '导出 PNG 角色卡失败' });
  }
});

// GET /api/items/:id/cover
router.get('/items/:id/cover', (req, res) => {
  const row = db.prepare('SELECT cover_path FROM items WHERE id = ?').get(req.params.id);
  if (!row || !row.cover_path) return res.status(404).end();

  const fullPath = path.join(COVERS_DIR, row.cover_path);
  if (!fs.existsSync(fullPath)) return res.status(404).end();

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(fullPath);
});

// POST /api/items/:id/cover
router.post('/items/:id/cover', upload.single('cover'), (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });
  if (!req.file) return res.status(400).json({ error: '请选择图片文件' });

  const ext = path.extname(req.file.originalname || '').toLowerCase() || '.png';
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    return res.status(400).json({ error: '仅支持 PNG / JPG / WEBP 格式封面' });
  }

  // Remove old cover if different filename
  if (row.cover_path) {
    const oldCover = path.join(COVERS_DIR, row.cover_path);
    if (fs.existsSync(oldCover)) {
      try { fs.unlinkSync(oldCover); } catch { /* ignore */ }
    }
  }

  const coverFilename = `${row.id}${ext}`;
  fs.writeFileSync(path.join(COVERS_DIR, coverFilename), req.file.buffer);
  const now = new Date().toISOString();
  db.prepare('UPDATE items SET cover_path = ?, updated_at = ? WHERE id = ?').run(coverFilename, now, row.id);

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(row.id);
  res.json({ item: serializeRow(updated) });
});

// PATCH /api/items/:id
router.patch('/items/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });

  const { name, creator, version, category, folder, notes, tags, favorite } = req.body;
  const now = new Date().toISOString();

  const nextName = typeof name === 'string' && name.trim() ? name.trim() : row.name;
  const nextCreator = typeof creator === 'string' ? creator.trim() : row.creator;
  const nextVersion = typeof version === 'string' ? version.trim() : row.version;
  const nextCategory = ['character', 'preset', 'theme', 'worldbook', 'other'].includes(category) ? category : row.category;
  const nextFolder = typeof folder === 'string' ? folder.trim() : row.folder;
  const nextNotes = typeof notes === 'string' ? notes : row.notes;
  const nextTags = Array.isArray(tags) ? JSON.stringify(tags.map((t) => String(t).trim()).filter(Boolean)) : row.tags;
  const nextFavorite = typeof favorite === 'boolean' ? (favorite ? 1 : 0) : row.favorite;

  db.prepare(`
    UPDATE items
    SET name = ?, creator = ?, version = ?, category = ?, folder = ?, notes = ?, tags = ?, favorite = ?, updated_at = ?
    WHERE id = ?
  `).run(nextName, nextCreator, nextVersion, nextCategory, nextFolder, nextNotes, nextTags, nextFavorite, now, row.id);

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(row.id);
  res.json({ item: serializeRow(updated) });
});

// DELETE /api/items/:id
router.delete('/items/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '未找到该档案' });

  db.prepare('DELETE FROM items WHERE id = ?').run(row.id);

  const fileFull = path.join(FILES_DIR, row.file_path);
  if (fs.existsSync(fileFull)) {
    try { fs.unlinkSync(fileFull); } catch { /* ignore */ }
  }
  if (row.cover_path) {
    const coverFull = path.join(COVERS_DIR, row.cover_path);
    if (fs.existsSync(coverFull)) {
      try { fs.unlinkSync(coverFull); } catch { /* ignore */ }
    }
  }

  res.json({ ok: true });
});

export default router;
