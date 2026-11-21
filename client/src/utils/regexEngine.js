/**
 * SillyTavern Regex & Greeting Rendering Engine
 * Shared by GreetingPreviewPanel and RegexPreviewPanel.
 */

export function isVisualReplace(str) {
  if (!str || typeof str !== 'string') return false;
  return /<(style|div|section|article|table|span|header|main|details|svg|html|body|link|p|h[1-6]|ul|ol|iframe|canvas|script)\b/i.test(str);
}

export function hasHtmlMarkup(str) {
  if (!str || typeof str !== 'string') return false;
  return /<(style|div|section|article|table|span|header|main|details|summary|svg|p|br|hr|img|a|b|i|em|strong|font|center|h[1-6]|ul|ol|li|blockquote|pre|code|script)\b[^>]*>/i.test(str);
}

function escapeRegexLiteral(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function applyMacros(text, { charName = 'Character', userName = 'User', escapeForRegex = false } = {}) {
  if (!text || typeof text !== 'string') return '';
  const charVal = escapeForRegex ? escapeRegexLiteral(charName || 'Character') : (charName || 'Character');
  const userVal = escapeForRegex ? escapeRegexLiteral(userName || 'User') : (userName || 'User');
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, charVal)
    .replace(/\{\{\s*user\s*\}\}/gi, userVal);
}

export function parseRegexString(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Match /pattern/flags
  const m = trimmed.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
  try {
    if (m) {
      return new RegExp(m[1], m[2] || 'g');
    }
    return new RegExp(trimmed, 'g');
  } catch {
    return null;
  }
}

/**
 * SillyTavern placement values:
 * 1 = User Input, 2 = AI Output, 3 = Slash Command, 5 = World Info, 6 = Reasoning
 * Greetings are rendered as AI Output (placement includes 2, or placement is unspecified/empty).
 */
export function isDefaultGreetingScript(script) {
  if (!script) return false;
  if (script.disabled) return false;
  if (script.promptOnly) return false;
  if (Array.isArray(script.placement) && script.placement.length > 0) {
    return script.placement.includes(2);
  }
  return true;
}

function applyTrimStrings(value, trimStrings) {
  if (!value || !Array.isArray(trimStrings) || trimStrings.length === 0) return value;
  let out = value;
  for (const t of trimStrings) {
    if (typeof t === 'string' && t.length > 0) {
      out = out.split(t).join('');
    }
  }
  return out;
}

/**
 * Run a single SillyTavern regex script against text.
 */
export function runSingleRegex(text, script, macroCtx = {}) {
  if (!text || typeof text !== 'string' || !script?.findRegex) {
    return { output: text || '', matched: false, matchCount: 0 };
  }

  let rawFind = script.findRegex;
  if (script.substituteRegex === 1) {
    rawFind = applyMacros(rawFind, { ...macroCtx, escapeForRegex: false });
  } else if (script.substituteRegex === 2) {
    rawFind = applyMacros(rawFind, { ...macroCtx, escapeForRegex: true });
  }

  const regex = parseRegexString(rawFind);
  if (!regex) {
    return { output: text, matched: false, matchCount: 0 };
  }

  const replaceTemplate = typeof script.replaceString === 'string' ? script.replaceString : '';
  const trimStrings = Array.isArray(script.trimStrings) ? script.trimStrings : [];

  let matchCount = 0;
  try {
    const output = text.replace(regex, (...args) => {
      matchCount++;
      const fullMatch = args[0];
      const hasNamedGroups = typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null;
      const groupsEnd = hasNamedGroups ? args.length - 3 : args.length - 2;
      const captures = args.slice(1, Math.max(1, groupsEnd));
      const namedGroups = hasNamedGroups ? args[args.length - 1] : null;

      const trimmedFull = applyTrimStrings(fullMatch, trimStrings);
      // 1. Replace {{match}} first (SillyTavern convention)
      let replaced = replaceTemplate.replace(/\{\{\s*match\s*\}\}/gi, () => trimmedFull);

      // 2. Replace $&, $$, $<name>, $1..$99
      replaced = replaced.replace(/\$(?:\$|&|<([^>]+)>|(\d{1,2}))/g, (token, named, numStr) => {
        if (token === '$$') return '$';
        if (token === '$&') return trimmedFull;
        if (named !== undefined) {
          const v = namedGroups?.[named];
          return v !== undefined ? applyTrimStrings(String(v), trimStrings) : '';
        }
        if (numStr !== undefined) {
          const idx = Number(numStr) - 1;
          if (idx >= 0 && idx < captures.length) {
            const v = captures[idx];
            return v !== undefined ? applyTrimStrings(String(v), trimStrings) : '';
          }
          if (numStr.length === 2) {
            const firstIdx = Number(numStr[0]) - 1;
            if (firstIdx >= 0 && firstIdx < captures.length) {
              const v = captures[firstIdx];
              return (v !== undefined ? applyTrimStrings(String(v), trimStrings) : '') + numStr[1];
            }
          }
          return '';
        }
        return token;
      });

      return replaced;
    });

    return { output, matched: matchCount > 0, matchCount };
  } catch {
    return { output: text, matched: false, matchCount: 0 };
  }
}

/**
 * Run a pipeline of regex scripts on greeting text.
 */
export function runRegexPipeline(text, scripts, options = {}) {
  const {
    enabledIds = null,
    enableMacros = true,
    charName = 'Character',
    userName = 'User',
  } = options;

  let current = typeof text === 'string' ? text : '';
  const macroCtx = { charName, userName };

  if (enableMacros) {
    current = applyMacros(current, macroCtx);
  }

  const matchedScripts = [];
  const list = Array.isArray(scripts) ? scripts : [];

  for (const script of list) {
    const shouldRun = enabledIds ? enabledIds.has(script.id) : isDefaultGreetingScript(script);
    if (!shouldRun) continue;

    const res = runSingleRegex(current, script, macroCtx);
    if (res.matched) {
      current = res.output;
      matchedScripts.push({
        id: script.id,
        scriptName: script.scriptName,
        matchCount: res.matchCount,
      });
    }
  }

  if (enableMacros) {
    current = applyMacros(current, macroCtx);
  }

  return {
    output: current,
    matchedScripts,
  };
}

function isFullHtmlDocument(code) {
  return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(code);
}

function isRenderableHtmlFence(lang, code) {
  const l = (lang || '').trim().toLowerCase();
  if (l === 'html' || l === 'htm') return true;
  if (isFullHtmlDocument(code)) return true;
  if (!l && isVisualReplace(code)) return true;
  return false;
}

/**
 * Wrap a standalone HTML document (e.g. ```html <html>...</html> ``` from Tavern Helper regexes)
 * into an isolated auto-resizing nested iframe so multiple widgets never clash on CSS/JS.
 */
function buildNestedIframeTag(rawDoc, nestedId) {
  const resizeScript = `<script>
(function(){
  var id=${JSON.stringify(nestedId)};
  function report(){
    var b=document.body,d=document.documentElement;
    var h=Math.max(b?b.scrollHeight:0,d?d.scrollHeight:0,b?b.offsetHeight:0);
    if(h>0) parent.postMessage({type:'st-nested-resize',nestedId:id,height:h+6},'*');
  }
  window.addEventListener('load',function(){report();setTimeout(report,160);setTimeout(report,500);});
  if(typeof ResizeObserver!=='undefined'&&document.documentElement){
    new ResizeObserver(report).observe(document.documentElement);
  }
  setTimeout(report,50);
})();
<\/script>`;

  const baseStyle = `<style>html,body{margin:0;padding:0;background:transparent;overflow-x:auto;}</style>`;
  let doc = rawDoc.trim();

  if (!/<html[\s>]/i.test(doc)) {
    doc = `<!doctype html><html><head><meta charset="utf-8" />${baseStyle}</head><body>${doc}${resizeScript}</body></html>`;
  } else {
    if (/<\/head>/i.test(doc)) {
      doc = doc.replace(/<\/head>/i, `${baseStyle}</head>`);
    }
    if (/<\/body>/i.test(doc)) {
      doc = doc.replace(/<\/body>/i, `${resizeScript}</body>`);
    } else if (/<\/html>/i.test(doc)) {
      doc = doc.replace(/<\/html>/i, `${resizeScript}</html>`);
    } else {
      doc += resizeScript;
    }
  }

  return `<iframe class="st-nested-frame" data-nested-id="${nestedId}" sandbox="allow-scripts" scrolling="no" srcdoc="${escapeHtmlAttr(doc)}"></iframe>`;
}

/**
 * Unwrap Tavern Helper ```html ... ``` fences and isolate full <html> documents
 * into nested auto-resizing iframes. Safe to run even when Markdown formatting is disabled.
 */
export function unwrapRenderableHtmlBlocks(input) {
  if (!input || typeof input !== 'string') return '';
  let text = input.replace(/\r\n/g, '\n');
  let nestedCounter = 0;
  const stashed = [];
  const stash = (html) => {
    const idx = stashed.length;
    stashed.push(html);
    return `\uE000NESTED_${idx}\uE001`;
  };

  // 1. Unwrap ```html ... ``` or renderable HTML fenced blocks
  text = text.replace(/```([a-zA-Z0-9_-]*)[ \t]*\n([\s\S]*?)```/g, (full, lang, code) => {
    if (isRenderableHtmlFence(lang, code)) {
      const trimmed = code.trim();
      if (isFullHtmlDocument(trimmed) || /<script[\s>]/i.test(trimmed)) {
        return stash(buildNestedIframeTag(trimmed, `nested-${++nestedCounter}`));
      }
      return trimmed;
    }
    return full;
  });

  // 2. Isolate bare full HTML documents (<!doctype html>...</html> or <html>...</html>)
  text = text.replace(/(?:<!doctype\s+html[^>]*>\s*)?<html\b[^>]*>[\s\S]*?<\/html>/gi, (match) => {
    return stash(buildNestedIframeTag(match, `nested-${++nestedCounter}`));
  });

  // 3. Restore stashed nested iframes so step 2 never re-matches inside srcdoc attributes
  return text.replace(/\uE000NESTED_(\d+)\uE001/g, (_, idx) => stashed[Number(idx)] ?? '');
}

/**
 * Basic Markdown formatter that preserves HTML tags, nested iframes, <style>, <script>, and HTML comments.
 */
export function formatMarkdownPreservingHtml(input) {
  if (!input || typeof input !== 'string') return '';

  const placeholders = [];
  const stash = (content) => {
    const idx = placeholders.length;
    placeholders.push(content);
    return `\uE000STASH_${idx}\uE001`;
  };

  let text = input.replace(/\r\n/g, '\n');
  let nestedCounter = 0;

  // 1. Handle fenced code blocks FIRST so <style>/<script> inside them are not stashed prematurely
  text = text.replace(/```([a-zA-Z0-9_-]*)[ \t]*\n([\s\S]*?)```/g, (_, lang, code) => {
    if (isRenderableHtmlFence(lang, code)) {
      const trimmed = code.trim();
      if (isFullHtmlDocument(trimmed) || /<script[\s>]/i.test(trimmed)) {
        return stash(buildNestedIframeTag(trimmed, `nested-${++nestedCounter}`));
      }
      return stash(trimmed);
    }
    return stash(`<pre class="st-md-pre"><code>${escapeHtmlText(code)}</code></pre>`);
  });

  // 2. Isolate bare full HTML documents (<!doctype html>...</html> or <html>...</html>)
  text = text.replace(/(?:<!doctype\s+html[^>]*>\s*)?<html\b[^>]*>[\s\S]*?<\/html>/gi, (match) => {
    return stash(buildNestedIframeTag(match, `nested-${++nestedCounter}`));
  });

  // 3. Protect remaining <style>, <script>, and HTML comments
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => stash(m));
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => stash(m));
  text = text.replace(/<!--[\s\S]*?-->/g, (m) => stash(m));

  // 4. Split by HTML tags so inline markdown never corrupts tag attributes
  const parts = text.split(/(<\/?[a-zA-Z][^>]*>)/g);

  const formatted = parts
    .map((part) => {
      if (!part) return '';
      if (/^<\/?[a-zA-Z][^>]*>$/.test(part)) {
        return part;
      }

      let s = part;

      // Inline code
      s = s.replace(/`([^`\n]+?)`/g, (_, code) => {
        return stash(`<code class="st-md-code">${escapeHtmlText(code)}</code>`);
      });

      // Headings / Blockquotes / Horizontal rules at line starts
      s = s.replace(/^###\s+(.+)$/gm, '<h3 class="st-md-h">$1</h3>');
      s = s.replace(/^##\s+(.+)$/gm, '<h2 class="st-md-h">$1</h2>');
      s = s.replace(/^#\s+(.+)$/gm, '<h1 class="st-md-h">$1</h1>');
      s = s.replace(/^>\s?(.*)$/gm, '<blockquote class="st-md-quote">$1</blockquote>');
      s = s.replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, '<hr class="st-md-hr" />');

      // Bold + Italic, Bold, Italic, Strikethrough
      s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^\w*])\*([^*\n]+?)\*(?!\*)/g, '$1<em class="st-md-em">$2</em>');
      s = s.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');

      // Highlight dialogue quotes gently (Chinese quotes)
      s = s.replace(/(“[^”\n]+”|「[^」\n]+」)/g, '<span class="st-md-quote-text">$1</span>');

      return s;
    })
    .join('');

  // 5. Convert newlines outside block tags into <br />
  let withBreaks = formatted
    .replace(/(<\/(?:div|section|article|header|footer|main|aside|nav|table|thead|tbody|tr|td|th|ul|ol|li|p|h[1-6]|blockquote|details|summary|pre|hr|style|script|iframe)>)\n+/gi, '$1')
    .replace(/\n+(<(?:div|section|article|header|footer|main|aside|nav|table|ul|ol|p|h[1-6]|blockquote|details|pre|hr|iframe)\b)/gi, '$1')
    .replace(/(\uE000STASH_\d+\uE001)\n+/g, '$1')
    .replace(/\n+(\uE000STASH_\d+\uE001)/g, '$1')
    .replace(/\n/g, '<br />\n');

  // 6. Restore stashed blocks
  withBreaks = withBreaks.replace(/\uE000STASH_(\d+)\uE001/g, (_, idx) => placeholders[Number(idx)] ?? '');

  return withBreaks;
}

/**
 * Build an isolated iframe srcdoc document with auto-height ResizeObserver reporting
 * and support for nested auto-resizing HTML widget iframes.
 */
export function buildSandboxSrcdoc(html, frameId, theme = 'dark', options = {}) {
  const isDark = theme === 'dark';
  const bg = isDark ? '#141821' : '#f8fafc';
  const fg = isDark ? '#e6edf7' : '#1e293b';
  const emColor = isDark ? '#94a3b8' : '#64748b';
  const quoteColor = isDark ? '#fbbf24' : '#b45309';
  const codeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const borderCol = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.14)';
  const padding = options.padding || '16px';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${bg};
    color: ${fg};
    font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.72;
    overflow-x: auto;
    word-break: break-word;
  }
  #st-preview-root {
    padding: ${padding};
    min-height: 80px;
  }
  img { max-width: 100%; height: auto; }
  .st-nested-frame {
    width: 100%;
    border: none;
    display: block;
    min-height: 60px;
    margin: 8px 0;
    background: transparent;
  }
  .st-md-em { color: ${emColor}; font-style: italic; }
  .st-md-quote-text { color: ${quoteColor}; }
  .st-md-h { margin: 0.7em 0 0.4em; line-height: 1.35; }
  .st-md-quote {
    margin: 0.5em 0;
    padding: 4px 12px;
    border-left: 3px solid ${borderCol};
    color: ${emColor};
  }
  .st-md-hr {
    border: none;
    border-top: 1px solid ${borderCol};
    margin: 12px 0;
  }
  .st-md-code {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 0.9em;
    padding: 1px 5px;
    border-radius: 4px;
    background: ${codeBg};
  }
  .st-md-pre {
    margin: 8px 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: ${codeBg};
    overflow-x: auto;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12.5px;
  }
</style>
</head>
<body>
  <div id="st-preview-root">${html}</div>
  <script>
    (function() {
      var frameId = ${JSON.stringify(frameId)};
      function report() {
        var root = document.getElementById('st-preview-root');
        var h = Math.max(
          root ? root.scrollHeight : 0,
          document.body ? document.body.scrollHeight : 0
        );
        parent.postMessage({ type: 'st-regex-resize', frameId: frameId, height: h + 12 }, '*');
      }
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'st-nested-resize' && e.data.nestedId) {
          var f = document.querySelector('iframe[data-nested-id="' + e.data.nestedId + '"]');
          if (f) {
            f.style.height = Math.max(40, Number(e.data.height) || 120) + 'px';
            report();
          }
        }
      });
      window.addEventListener('load', function() { report(); setTimeout(report, 180); setTimeout(report, 600); });
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(report).observe(document.body);
      }
      setTimeout(report, 60);
    })();
  <\/script>
</body>
</html>`;
}
