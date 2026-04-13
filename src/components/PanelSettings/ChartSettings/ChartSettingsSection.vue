<script setup>
import { Trash } from '@vicons/tabler';
import mountStyle from './ChartSettingsSection.style.cssr.js';
import { colorCustomChartExample } from '../../../charts';

const props = defineProps({
  settings: {
    type: Object,
    default: null,
  },
});

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);

const settings = computed(() => props.settings || null);
const chartDefs = computed(() => settings.value?.chartDefs?.value || []);
const customCharts = computed(() => settings.value?.customCharts?.value || []);
const transferOptions = computed(() => {
  return chartDefs.value.map((item) => ({
    label: item.title || item.key,
    value: item.key,
  }));
});
const activeCustomKey = ref('');

const visibleChartKeysModel = computed({
  get: () => settings.value?.visibleChartKeys?.value || [],
  set: (value) => {
    if (!settings.value?.visibleChartKeys) return;
    settings.value.visibleChartKeys.value = Array.isArray(value) ? value : [];
  },
});

const newChartCodeModel = computed({
  get: () => String(settings.value?.newChartCode?.value || ''),
  set: (value) => {
    if (!settings.value?.newChartCode) return;
    settings.value.newChartCode.value = String(value || '');
  },
});

const removeCustomChart = (chartKey) => {
  settings.value?.removeCustomChart?.(chartKey);
  if (activeCustomKey.value === chartKey) {
    activeCustomKey.value = '';
  }
};

const addCustomChart = () => {
  const key = settings.value?.addCustomChart?.();
  if (key) activeCustomKey.value = key;
};

const startCreateCustomChart = () => {
  activeCustomKey.value = '';
  if (!settings.value?.newChartCode) return;
  settings.value.newChartCode.value = colorCustomChartExample;
};

const selectCustomChart = (chartKey) => {
  activeCustomKey.value = chartKey;
  const code = settings.value?.getCustomChartCode?.(chartKey);
  if (!settings.value?.newChartCode) return;
  settings.value.newChartCode.value = String(code || '');
};

onMounted(() => {
  startCreateCustomChart();
});

watch(customCharts, (items) => {
  if (!activeCustomKey.value) return;
  if (items.some((item) => item.key === activeCustomKey.value)) return;
  activeCustomKey.value = '';
});
</script>

<template>
  <div class="bds-chart-settings">
    <div class="bds-chart-settings__block">
      <n-divider style="margin: 4px 0;">可见图表</n-divider>
      <n-transfer v-model:value="visibleChartKeysModel" :options="transferOptions" source-title="全部图表"
        target-title="已启用图表" />
    </div>

    <div class="bds-chart-settings__block">
      <n-divider style="margin: 4px 0;">自定义图表</n-divider>
      <n-grid :cols="24" :x-gap="12" :y-gap="12">
        <n-gi :span="16">
          <n-input v-model:value="newChartCodeModel" type="textarea" :rows="13"
            placeholder="输入图表对象代码，如 ({ name:'demo', title:'示例', expandedH:false, refresh:true, render(){ ... } })" />
        </n-gi>
        <n-gi :span="8">
          <n-flex vertical align="center">
            <n-flex style="margin-bottom: 12px; width: 100%;">
              <n-button type="primary" size="small" style="flex: 1;" @click="startCreateCustomChart">
                新建
              </n-button>
              <n-button type="primary" size="small" style="flex: 1;" @click="addCustomChart">
                保存
              </n-button>
            </n-flex>

            <n-empty v-if="!customCharts.length" description="暂无自定义图表" size="small" />
            <n-list v-else hoverable clickable style="width: 100%;">
              <n-list-item v-for="item in customCharts" :key="item.key" @click="selectCustomChart(item.key)">
                <div class="bds-chart-settings__custom-row">
                  <n-button text :type="item.key === activeCustomKey ? 'primary' : 'default'">
                    {{ item.title || item.key }}
                  </n-button>
                  <n-button size="tiny" tertiary type="error" title="删除图表" aria-label="删除图表"
                    @click.stop="removeCustomChart(item.key)">
                    <template #icon>
                      <n-icon>
                        <trash />
                      </n-icon>
                    </template>
                  </n-button>
                </div>
              </n-list-item>
            </n-list>
          </n-flex>
        </n-gi>
      </n-grid>
    </div>
  </div>
</template>
