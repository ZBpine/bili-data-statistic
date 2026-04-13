<script setup>
import ChartSettingsSection from './ChartSettings/ChartSettingsSection.vue';
import ExternalPageSettingsSection from './ExternalPageSettings/ExternalPageSettingsSection.vue';
import ThemeSettingsSection from './ThemeSettings/ThemeSettingsSection.vue';
import mountStyle from './PanelSettings.style.cssr.js';

const props = defineProps({
  chartSettings: {
    type: Object,
    default: null,
  },
  themeSettings: {
    type: Object,
    default: null,
  },
  mode: {
    type: String,
    default: 'script',
  },
});

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);

const tabValue = ref('chart');
</script>

<template>
  <div class="bds-panel-settings-body">
    <n-tabs v-model:value="tabValue" type="line" animated>
      <n-tab-pane name="chart" tab="图表设置">
        <chart-settings-section :settings="props.chartSettings" />
      </n-tab-pane>
      <n-tab-pane name="theme" tab="主题设置">
        <theme-settings-section :theme-settings="props.themeSettings" :active="tabValue === 'theme'" />
      </n-tab-pane>
      <n-tab-pane v-if="props.mode === 'script'" name="external" tab="外部页面">
        <external-page-settings-section />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>
