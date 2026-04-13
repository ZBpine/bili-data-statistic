<script setup>
import mountStyle from './ThemeSettingsSection.style.cssr.js';
import {
  DEFAULT_THEME,
  createDarkThemeOverrides,
  createLightThemeOverrides,
} from '../../../utils/theme.js';

const props = defineProps({
  themeSettings: {
    type: Object,
    default: null,
  },
  active: {
    type: Boolean,
    default: false,
  },
});

const styleMountTarget = inject('styleMountTarget', null);
const activeTheme = inject('activeTheme', computed(() => 'light'));
mountStyle(styleMountTarget);

const themeColorDraft = ref('#00a1d6');
const previewColor = ref('');

const themeModeValue = computed(() => {
  return props.themeSettings?.mode?.value || 'auto';
});

const applyToChartsModel = computed({
  get: () => Boolean(props.themeSettings?.applyToCharts?.value),
  set: (value) => {
    if (!props.themeSettings?.applyToCharts) return;
    props.themeSettings.applyToCharts.value = Boolean(value);
  },
});

const activeThemeMode = computed(() => {
  return activeTheme?.value === 'dark' ? 'dark' : 'light';
});

const activeThemeLabel = computed(() => {
  return activeThemeMode.value === 'dark' ? '暗色主题色' : '亮色主题色';
});

const previewOverrides = computed(() => {
  const color = String(previewColor.value || '').trim();
  if (!color) return undefined;
  return activeThemeMode.value === 'dark'
    ? createDarkThemeOverrides(color)
    : createLightThemeOverrides(color);
});

const syncThemeDraft = () => {
  previewColor.value = '';
  themeColorDraft.value = String(
    activeThemeMode.value === 'dark'
      ? props.themeSettings?.darkPrimary?.value
      : props.themeSettings?.lightPrimary?.value,
  ) || '#00a1d6';
};

const setThemeMode = (mode) => {
  props.themeSettings?.setMode?.(mode);
};

const applyThemeDraft = () => {
  const currentLight = String(props.themeSettings?.lightPrimary?.value || DEFAULT_THEME.lightPrimary);
  const currentDark = String(props.themeSettings?.darkPrimary?.value || DEFAULT_THEME.darkPrimary);
  props.themeSettings?.applyColors?.({
    light: activeThemeMode.value === 'light' ? themeColorDraft.value : currentLight,
    dark: activeThemeMode.value === 'dark' ? themeColorDraft.value : currentDark,
  });
  previewColor.value = '';
  syncThemeDraft();
};

const testThemeDraft = () => {
  previewColor.value = themeColorDraft.value;
};

const resetThemeDefault = () => {
  const defaultColor = activeThemeMode.value === 'dark' ? DEFAULT_THEME.darkPrimary : DEFAULT_THEME.lightPrimary;
  themeColorDraft.value = defaultColor;
  applyThemeDraft();
};

watch(
  () => [props.active, activeThemeMode.value],
  ([active]) => {
    if (active) syncThemeDraft();
  },
  { immediate: true },
);
</script>

<template>
  <n-config-provider :theme-overrides="previewOverrides">
    <div class="bds-theme-settings">
      <n-form-item label="主题模式" style="margin-bottom: 0;">
        <n-radio-group :value="themeModeValue" @update:value="setThemeMode">
          <n-space>
            <n-radio-button value="light">亮色</n-radio-button>
            <n-radio-button value="dark">暗色</n-radio-button>
            <n-radio-button value="auto">跟随系统</n-radio-button>
          </n-space>
        </n-radio-group>
      </n-form-item>

      <n-form-item :label="activeThemeLabel" style="margin-bottom: 0;">
        <n-color-picker v-model:value="themeColorDraft" :modes="['hex']" :show-alpha="false" />
        <n-button type="primary" style="margin-left: 8px;" @click="testThemeDraft">测试主题色</n-button>
      </n-form-item>

      <n-flex justify="end" align="center">
        <n-checkbox v-model:checked="applyToChartsModel">应用于图表</n-checkbox>
        <n-button @click="resetThemeDefault">恢复默认</n-button>
        <n-button type="primary" @click="applyThemeDraft">应用主题色</n-button>
      </n-flex>
    </div>
  </n-config-provider>
</template>
