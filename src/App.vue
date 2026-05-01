<script setup>
import { darkTheme, dateZhCN, useOsTheme, zhCN } from 'naive-ui';
import mountStyle from './App.style.cssr.js';
import storage from './utils/storage';
import {
  DEFAULT_THEME,
  createDarkThemeOverrides,
  createLightThemeOverrides,
  normalizeThemeColor,
  normalizeThemeMode,
} from './utils/theme.js';
import EntryLauncher from './components/EntryLauncher';
import PanelShell from './components/PanelShell';
import UploadScreen from './components/UploadScreen';
import DmPanel from './pages/DmPanel.vue';
import UserPanel from './pages/UserPanel.vue';

const styleMountTarget = inject('styleMountTarget', null);
const BDM = inject('BDM', null);
const APP_MODE = inject('APP_MODE', ref('script'));
const data = inject('data', shallowRef(null));
const sourceUrl = inject('sourceUrl', shallowRef(''));

mountStyle(styleMountTarget);

const showPanel = ref(false);
const appError = '';
const isScriptApp = computed(() => APP_MODE.value === 'script');
const hasProvidedData = computed(() => Boolean(data?.value && typeof data.value === 'object'));
if (isScriptApp.value) {
  sourceUrl.value = location.href;
}
const isUserPage = computed(() => {
  const urlText = String(sourceUrl?.value || '').trim();
  if (!urlText) return false;
  try {
    return new URL(urlText).hostname === 'space.bilibili.com';
  } catch {
    return false;
  }
});
const panelSize = computed(() => {
  if (!isScriptApp.value) return 90;
  return isUserPage.value ? 60 : 80;
});
const entryLabel = computed(() => (isUserPage.value ? '用户信息' : '弹幕统计'));

const themeMode = ref(normalizeThemeMode(storage.get('theme.mode', DEFAULT_THEME.mode)));
const lightPrimary = ref(normalizeThemeColor(storage.get('theme.lightPrimary', DEFAULT_THEME.lightPrimary), DEFAULT_THEME.lightPrimary));
const darkPrimary = ref(normalizeThemeColor(storage.get('theme.darkPrimary', DEFAULT_THEME.darkPrimary), DEFAULT_THEME.darkPrimary));
const applyToCharts = ref(Boolean(storage.get('theme.applyToCharts', false)));
const osTheme = useOsTheme();
const isDarkThemeActive = computed(() => {
  if (themeMode.value === 'dark') return true;
  if (themeMode.value === 'light') return false;
  return osTheme.value === 'dark';
});
const theme = computed(() => {
  return isDarkThemeActive.value ? darkTheme : null;
});
const shellStyle = computed(() => ({
  colorScheme: isDarkThemeActive.value ? 'dark' : 'light',
}));
const themeOverrides = computed(() => {
  return isDarkThemeActive.value
    ? createDarkThemeOverrides(darkPrimary.value)
    : createLightThemeOverrides(lightPrimary.value);
});
const activeTheme = computed(() => (isDarkThemeActive.value ? 'dark' : 'light'));
const activePrimary = computed(() => (isDarkThemeActive.value ? darkPrimary.value : lightPrimary.value));

const applyThemeColors = ({ light, dark }) => {
  const nextLight = normalizeThemeColor(light, lightPrimary.value);
  const nextDark = normalizeThemeColor(dark, darkPrimary.value);
  lightPrimary.value = nextLight;
  darkPrimary.value = nextDark;
  storage.set('theme.lightPrimary', nextLight);
  storage.set('theme.darkPrimary', nextDark);
};

const setThemeMode = (mode) => {
  const next = normalizeThemeMode(mode);
  if (themeMode.value === next) return;
  themeMode.value = next;
  storage.set('theme.mode', next);
};

provide('themeSettings', {
  mode: themeMode,
  lightPrimary,
  darkPrimary,
  activePrimary,
  applyToCharts,
  setMode: setThemeMode,
  applyColors: applyThemeColors,
});
provide('activeTheme', activeTheme);

watch(activePrimary, (color) => {
  BDM.changeColor(color);
}, { immediate: true });

watch(applyToCharts, (value) => {
  storage.set('theme.applyToCharts', Boolean(value));
});

const panelShellRef = ref(null);
const panelEl = computed(() => panelShellRef.value?.panelEl || null);

const KEYBOARD_EVENTS = ['keydown', 'keypress', 'keyup'];
const POINTER_EVENTS = [
  'pointerdown',
  'pointerup',
  'pointercancel',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'touchcancel',
];

const bindWindowEvents = (eventList, handler, enable, options = true) => {
  const method = enable ? 'addEventListener' : 'removeEventListener';
  for (const type of eventList) {
    window[method](type, handler, options);
  }
};

const blockPanelKeyboardEvent = (event) => {
  if (!showPanel.value) return;
  const root = panelEl.value;
  if (!root) return;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (Array.isArray(path) && path.length && !path.includes(root)) return;
  event.stopPropagation();
  event.stopImmediatePropagation?.();
};

const blockPanelPointerEvent = (event) => {
  if (!showPanel.value) return;
  const root = panelEl.value;
  if (!root) return;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (Array.isArray(path) && path.length && !path.includes(root)) return;
  const hasButtonInPath = Array.isArray(path) && path.some((node) => {
    return typeof node?.classList?.contains === 'function' && node.classList.contains('n-button');
  });
  if (!hasButtonInPath) return;
  event.stopPropagation();
  event.stopImmediatePropagation?.();
};

const activateWithData = async (nextData) => {
  showPanel.value = false;
  await nextTick();
  data.value = nextData;
  await nextTick();
  showPanel.value = true;
};

const handleParsedUploadData = async (parsed) => {
  await activateWithData(parsed);
};

const handleOpenPanel = () => {
  showPanel.value = true;
};

const handleTogglePanel = () => {
  const nextShow = !showPanel.value;
  if (nextShow && isScriptApp.value) {
    sourceUrl.value = location.href;
  }
  showPanel.value = nextShow;
};

watch(showPanel, (open) => {
  bindWindowEvents(KEYBOARD_EVENTS, blockPanelKeyboardEvent, open, true);
  bindWindowEvents(POINTER_EVENTS, blockPanelPointerEvent, open, true);
});

watch(
  hasProvidedData,
  (hasData) => {
    if (isScriptApp.value) return;
    if (hasData) showPanel.value = true;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  bindWindowEvents(KEYBOARD_EVENTS, blockPanelKeyboardEvent, false, true);
  bindWindowEvents(POINTER_EVENTS, blockPanelPointerEvent, false, true);
});
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN"
    :style-mount-target="styleMountTarget">
    <n-dialog-provider :to="panelEl || undefined">
      <n-notification-provider :to="panelEl || undefined">
        <n-message-provider :to="panelEl || undefined">
          <n-modal-provider :to="panelEl || undefined">
            <n-loading-bar-provider :to="panelEl || undefined">
              <div class="bds-shell" :class="{ 'bds-shell--static': !isScriptApp }" :style="shellStyle">
                <template v-if="isScriptApp">
                  <entry-launcher :label="entryLabel" @toggle="handleTogglePanel" />
                </template>

                <template v-else>
                  <upload-screen v-model:source-url="sourceUrl" :has-data="hasProvidedData" :mode="APP_MODE"
                    @open-panel="handleOpenPanel" @parsed-data="handleParsedUploadData" />
                </template>

                <panel-shell ref="panelShellRef" v-model:show="showPanel" :size="panelSize" :error="appError">
                  <dm-panel v-if="!isUserPage && BDM" v-model:url="sourceUrl" :to="panelEl || undefined"
                    :active="showPanel" :mode="APP_MODE" />
                  <user-panel v-if="isUserPage && BDM" :mode="APP_MODE" :url="sourceUrl" />
                </panel-shell>
              </div>
            </n-loading-bar-provider>
          </n-modal-provider>
        </n-message-provider>
      </n-notification-provider>
    </n-dialog-provider>
  </n-config-provider>
</template>
