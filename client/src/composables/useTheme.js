import { ref, computed } from 'vue';

const STORAGE_KEY = 'tavern-vault-theme';
const VALID_MODES = ['system', 'light', 'dark'];

function readStoredMode() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && VALID_MODES.includes(raw)) return raw;
  } catch {
    // ignore storage errors
  }
  return 'system';
}

const mediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const themeMode = ref(readStoredMode());
const systemPrefersDark = ref(mediaQuery ? mediaQuery.matches : false);

const resolvedTheme = computed(() => {
  if (themeMode.value === 'system') {
    return systemPrefersDark.value ? 'dark' : 'light';
  }
  return themeMode.value;
});

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

let initialized = false;

export function initTheme() {
  if (initialized) return;
  initialized = true;

  applyThemeToDocument(resolvedTheme.value);

  if (mediaQuery) {
    const onSystemChange = (e) => {
      systemPrefersDark.value = e.matches;
      if (themeMode.value === 'system') {
        applyThemeToDocument(resolvedTheme.value);
      }
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onSystemChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(onSystemChange);
    }
  }
}

export function setThemeMode(mode) {
  if (!VALID_MODES.includes(mode)) return;
  themeMode.value = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
  applyThemeToDocument(resolvedTheme.value);
}

export function useTheme() {
  initTheme();
  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
  };
}
