import path from 'node:path';
import { extractCharaFromPng, isPngBuffer } from './pngCard.js';

function stripExt(filename) {
  return path.basename(filename, path.extname(filename));
}

function truncate(str, max = 280) {
  if (!str || typeof str !== 'string') return '';
  const clean = str.replace(/\r\n/g, '\n').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function countEntries(entries) {
  if (!entries) return 0;
  if (Array.isArray(entries)) return entries.length;
  if (typeof entries === 'object') return Object.keys(entries).length;
  return 0;
}

export function extractCharacterSummary(json, originalFilename, format) {
  const d = json.data && typeof json.data === 'object' ? json.data : json;
  const spec = json.spec || (json.data ? 'chara_card_v2' : 'chara_card_v1');
  const specVersion = json.spec_version || (spec === 'chara_card_v3' ? '3.0' : spec === 'chara_card_v2' ? '2.0' : '1.0');
  const name = (d.name || json.name || stripExt(originalFilename)).trim();
  const creator = (d.creator || '').trim();
  const version = (d.character_version || '').trim();
  const tags = Array.isArray(d.tags) ? d.tags.filter(Boolean).map(String) : (Array.isArray(json.tags) ? json.tags.filter(Boolean).map(String) : []);
  const altGreetings = Array.isArray(d.alternate_greetings) ? d.alternate_greetings.length : 0;
  const worldbookEntries = countEntries(d.character_book?.entries);
  const regexCount = Array.isArray(d.extensions?.regex_scripts) ? d.extensions.regex_scripts.length : 0;
  const hasTavernHelper = Boolean(d.extensions?.tavern_helper);

  return {
    category: 'character',
    name,
    creator,
    version,
    format, // 'png' | 'json'
    tags,
    summary: truncate(d.creator_notes || d.description || d.scenario || d.first_mes || '', 260),
    metadata: {
      spec,
      spec_version: specVersion,
      alt_greetings_count: altGreetings,
      worldbook_name: d.character_book?.name || '',
      worldbook_entries_count: worldbookEntries,
      regex_scripts_count: regexCount,
      has_tavern_helper: hasTavernHelper,
      has_system_prompt: Boolean(d.system_prompt),
      has_post_history: Boolean(d.post_history_instructions),
      extension_keys: d.extensions && typeof d.extensions === 'object' ? Object.keys(d.extensions) : [],
    },
  };
}

export function extractPresetSummary(json, originalFilename) {
  const name = (json.name || stripExt(originalFilename)).trim();
  const prompts = Array.isArray(json.prompts) ? json.prompts : [];

  // Determine enabled count from prompt_order (character_id 100001 or first entry) or prompt.enabled
  let enabledCount = 0;
  let orderedIds = null;
  if (Array.isArray(json.prompt_order) && json.prompt_order.length > 0) {
    const orderGroup = json.prompt_order.find((g) => g.character_id === 100001) || json.prompt_order[0];
    if (orderGroup && Array.isArray(orderGroup.order)) {
      orderedIds = new Map(orderGroup.order.map((o) => [o.identifier, Boolean(o.enabled)]));
    }
  }

  for (const p of prompts) {
    if (orderedIds && orderedIds.has(p.identifier)) {
      if (orderedIds.get(p.identifier)) enabledCount++;
    } else if (p.enabled) {
      enabledCount++;
    }
  }

  // Try to grab intro/description from a prompt named like 简介/readme/note if present
  const introPrompt = prompts.find(
    (p) => typeof p.name === 'string' && /简介|说明|readme|info|intro|关于/i.test(p.name) && p.content
  );

  const presetType = Array.isArray(json.prompts)
    ? 'chat_completion'
    : (json.temp !== undefined || json.rep_pen !== undefined ? 'text_completion' : 'preset');

  return {
    category: 'preset',
    name,
    creator: '',
    version: '',
    format: 'json',
    tags: [presetType === 'chat_completion' ? 'Chat Completion' : 'Text Completion'],
    summary: truncate(introPrompt?.content || `包含 ${prompts.length} 个提示词模块（已启用 ${enabledCount} 个）`, 260),
    metadata: {
      preset_type: presetType,
      temperature: json.temperature ?? json.temp ?? null,
      top_p: json.top_p ?? null,
      top_k: json.top_k ?? null,
      min_p: json.min_p ?? null,
      frequency_penalty: json.frequency_penalty ?? null,
      presence_penalty: json.presence_penalty ?? null,
      repetition_penalty: json.repetition_penalty ?? json.rep_pen ?? null,
      max_context: json.openai_max_context ?? json.max_context ?? null,
      max_tokens: json.openai_max_tokens ?? json.max_length ?? null,
      prompts_total: prompts.length,
      prompts_enabled: enabledCount,
      stream: Boolean(json.stream_openai),
      show_thoughts: Boolean(json.show_thoughts),
      reasoning_effort: json.reasoning_effort ?? null,
    },
  };
}

export function extractThemeSummary(json, originalFilename) {
  const name = (json.name || stripExt(originalFilename)).trim();
  const css = typeof json.custom_css === 'string' ? json.custom_css : '';
  // Try to grab first comment block from custom_css for summary
  let cssIntro = '';
  const commentMatch = css.match(/\/\*([\s\S]*?)\*\//);
  if (commentMatch) {
    cssIntro = commentMatch[1]
      .replace(/[=\-*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    category: 'theme',
    name,
    creator: '',
    version: '',
    format: 'json',
    tags: [css.length > 0 ? 'Custom CSS' : 'Native Theme'],
    summary: truncate(cssIntro || `模糊强度 ${json.blur_strength ?? 0}px · 聊天宽度 ${json.chat_width ?? 50}%`, 260),
    metadata: {
      blur_strength: json.blur_strength ?? 0,
      chat_width: json.chat_width ?? 50,
      font_scale: json.font_scale ?? 1,
      custom_css_length: css.length,
      custom_css_lines: css ? css.split('\n').length : 0,
      colors: {
        main_text: json.main_text_color || '#ffffff',
        italics_text: json.italics_text_color || '#cccccc',
        underline_text: json.underline_text_color || '#cccccc',
        quote_text: json.quote_text_color || '#e0c097',
        blur_tint: json.blur_tint_color || 'rgba(0,0,0,0.4)',
        chat_tint: json.chat_tint_color || 'rgba(0,0,0,0.2)',
        user_mes: json.user_mes_blur_tint_color || 'rgba(20,20,30,0.4)',
        bot_mes: json.bot_mes_blur_tint_color || 'rgba(10,10,16,0.4)',
        border: json.border_color || 'rgba(255,255,255,0.15)',
        shadow: json.shadow_color || 'rgba(0,0,0,0.5)',
      },
      toggles: {
        fast_ui_mode: Boolean(json.fast_ui_mode),
        waifuMode: Boolean(json.waifuMode),
        timestamps_enabled: Boolean(json.timestamps_enabled),
        timer_enabled: Boolean(json.timer_enabled),
        mesIDDisplay_enabled: Boolean(json.mesIDDisplay_enabled),
        message_token_count_enabled: Boolean(json.message_token_count_enabled),
        noShadows: Boolean(json.noShadows),
      },
    },
  };
}

export function extractWorldbookSummary(json, originalFilename) {
  const name = (json.name || stripExt(originalFilename)).trim();
  const entriesCount = countEntries(json.entries);
  return {
    category: 'worldbook',
    name,
    creator: '',
    version: '',
    format: 'json',
    tags: ['World Info'],
    summary: `独立世界书，共包含 ${entriesCount} 条词条设定。`,
    metadata: {
      entries_count: entriesCount,
    },
  };
}

export function extractOtherSummary(json, originalFilename) {
  const isRegex = Boolean(json.findRegex !== undefined || (Array.isArray(json) && json[0]?.findRegex !== undefined));
  const name = (json.scriptName || json.name || stripExt(originalFilename)).trim();
  return {
    category: 'other',
    name,
    creator: '',
    version: '',
    format: 'json',
    tags: [isRegex ? 'Regex Script' : 'JSON'],
    summary: isRegex
      ? `正则脚本：${truncate(json.findRegex || '', 120)}`
      : `SillyTavern 扩展/配置文件`,
    metadata: {
      subtype: isRegex ? 'regex' : 'json',
      keys_count: typeof json === 'object' && json ? Object.keys(json).length : 0,
    },
  };
}

/**
 * Inspect an uploaded buffer + original filename and auto-detect its SillyTavern asset type.
 */
export function parseUploadedFile(buffer, originalFilename, categoryOverride = null) {
  const ext = path.extname(originalFilename).toLowerCase();

  if (ext === '.png' || isPngBuffer(buffer)) {
    const extracted = extractCharaFromPng(buffer);
    if (!extracted) {
      throw new Error('该 PNG 图片未包含 SillyTavern 角色卡数据（缺少 chara / ccv3 元数据块）');
    }
    const parsed = extractCharacterSummary(extracted.data, originalFilename, 'png');
    if (categoryOverride) parsed.category = categoryOverride;
    return {
      ...parsed,
      parsedJson: extracted.data,
      isPngCard: true,
    };
  }

  let json;
  try {
    json = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error('无法解析 JSON 文件，请检查文件格式是否完整');
  }

  let detected;
  if (categoryOverride === 'character') {
    detected = extractCharacterSummary(json, originalFilename, 'json');
  } else if (categoryOverride === 'preset') {
    detected = extractPresetSummary(json, originalFilename);
  } else if (categoryOverride === 'theme') {
    detected = extractThemeSummary(json, originalFilename);
  } else if (categoryOverride === 'worldbook') {
    detected = extractWorldbookSummary(json, originalFilename);
  } else if (categoryOverride === 'other') {
    detected = extractOtherSummary(json, originalFilename);
  } else {
    // Auto-detect
    if (
      json.spec === 'chara_card_v3' ||
      json.spec === 'chara_card_v2' ||
      (json.data && typeof json.data === 'object' && (json.data.first_mes !== undefined || json.data.description !== undefined)) ||
      (json.first_mes !== undefined && json.description !== undefined)
    ) {
      detected = extractCharacterSummary(json, originalFilename, 'json');
    } else if (
      json.main_text_color !== undefined ||
      json.blur_strength !== undefined ||
      json.custom_css !== undefined ||
      json.blur_tint_color !== undefined
    ) {
      detected = extractThemeSummary(json, originalFilename);
    } else if (
      Array.isArray(json.prompts) ||
      json.openai_max_context !== undefined ||
      (json.temperature !== undefined && json.top_p !== undefined) ||
      (json.temp !== undefined && json.rep_pen !== undefined)
    ) {
      detected = extractPresetSummary(json, originalFilename);
    } else if (json.entries && typeof json.entries === 'object') {
      detected = extractWorldbookSummary(json, originalFilename);
    } else {
      detected = extractOtherSummary(json, originalFilename);
    }
  }

  return {
    ...detected,
    parsedJson: json,
    isPngCard: false,
  };
}
