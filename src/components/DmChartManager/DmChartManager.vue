<script setup>
import { h, nextTick } from 'vue';
import * as naiveUi from 'naive-ui';
import mountStyle from './style.cssr.js';
import { defaultCharts } from '../../charts';
import storage from '../../utils/storage.js';
import { deltaE } from '../../utils/colorDistance.js';

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  chartCtx: {
    type: Object,
    default: () => ({}),
  },
  to: {
    type: [String, Object],
    default: undefined,
  },
});

const emit = defineEmits(['select-filter', 'update:chartMenus']);

const styleMountTarget = inject('styleMountTarget', null);
const runtimeWindow = inject('runtimeWindow', window);
const injectedActiveTheme = inject('activeTheme', null);
const themeSettings = inject('themeSettings', null);
const messageApi = naiveUi.useMessage();
mountStyle(styleMountTarget);

const echartsLib = computed(() => runtimeWindow?.echarts || globalThis.echarts);

const chartDefs = ref([]);
const chartDefMap = computed(() => new Map(chartDefs.value.map((def) => [def.key, def])));
const chartTestRef = ref(null);
const chartColors = ref([]);
const visibleChartKeys = ref([]);
const chartDomMap = reactive({});
const expandedByKey = reactive({});
const chartHover = ref(null);
const chartRuntimeMap = new Map();
const chartInstanceMap = new Map();
const chartRenderTaskMap = new Map();
const chartSizeMap = new Map();
const chartBodyRef = ref(null);

let renderQueue = Promise.resolve();

const echartsTheme = computed(() => {
  const value = unref(injectedActiveTheme);
  return value === 'dark' ? 'dark' : 'default';
});

const applyToCharts = computed(() => Boolean(themeSettings?.applyToCharts?.value));
const activePrimaryColor = computed(() => {
  return String(themeSettings?.activePrimary?.value || '').trim();
});

const newChartCode = ref('');
const customChartCodeMap = ref({});
const customCharts = computed(() => {
  return chartDefs.value
    .filter((item) => item.isCustom)
    .map((item) => ({
      key: item.key,
      title: item.title || item.key,
    }));
});

const hasChart = computed(() => visibleChartKeys.value.length > 0);

const sanitizeChartName = (name) => {
  return String(name || Date.now())
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 80);
};

const logError = (...args) => {
  props.chartCtx?.BDM?.logger?.error?.(...args);
};

const ensureChartColors = () => {
  if (chartColors.value.length) return chartColors.value;
  if (!echartsLib.value?.init || !chartTestRef.value) return [];

  let chartTest = null;
  try {
    chartTest = echartsLib.value.init(chartTestRef.value, echartsTheme.value);
    chartTest.setOption({});
    const colors = chartTest.getOption()?.color;
    const palette = Array.isArray(colors) ? colors.filter(Boolean) : [];
    if (!palette.length) return [];

    const primary = activePrimaryColor.value;
    if (!primary) {
      chartColors.value = palette;
      return chartColors.value;
    }

    let nearestIdx = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < palette.length; i += 1) {
      try {
        const distance = deltaE(palette[i], primary);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIdx = i;
        }
      } catch {
        // ignore invalid color
      }
    }

    const reordered = [primary, ...palette.filter((_, idx) => idx !== nearestIdx)];
    chartColors.value = reordered;
    return reordered;
  } catch (error) {
    logError('提取图表主题色失败', error);
    return [];
  } finally {
    if (chartTest?.dispose) chartTest.dispose();
  }
};

const buildFilterPayload = (chartKey, filterInput = {}) => {
  const value = filterInput.value;
  if (value == null || value === '') return null;
  if (typeof filterInput.predicate !== 'function') return null;

  return {
    source: filterInput.source || `chart:${chartKey}`,
    value,
    template: filterInput.template || '{value}',
    formatValue: filterInput.formatValue || ((v) => String(v)),
    predicate: filterInput.predicate,
    wrapTag: filterInput.wrapTag !== false,
  };
};

const stageChartFilter = async (chartKey, filterInput) => {
  const payload = buildFilterPayload(chartKey, filterInput);
  if (payload) emit('select-filter', payload);
};

const createChartContext = (chartKey) => {
  const localContext = {
    chartKey,
    get echarts() {
      return echartsLib.value;
    },
    get instance() {
      return chartInstanceMap.get(chartKey) || null;
    },
    get element() {
      return chartDomMap[chartKey] || null;
    },
    get items() {
      return props.items;
    },
    h,
    ui: naiveUi,
    stageFilter: (filterInput) => stageChartFilter(chartKey, filterInput),
    rerender: () => renderChart(chartKey),
    resize: () => resizeChart(chartKey),
  };

  return new Proxy(localContext, {
    get(target, key, receiver) {
      if (Reflect.has(target, key)) {
        return Reflect.get(target, key, receiver);
      }
      const extra = props.chartCtx || {};
      return Reflect.get(extra, key);
    },
    has(target, key) {
      if (Reflect.has(target, key)) return true;
      const extra = props.chartCtx || {};
      return Reflect.has(extra, key);
    },
  });
};

const ensureRuntime = (chartKey) => {
  const cached = chartRuntimeMap.get(chartKey);
  if (cached) return cached;

  const def = chartDefMap.value.get(chartKey);
  if (!def) return null;

  const runtime = { ...def };
  runtime.key = runtime.key || def.key || chartKey;
  runtime.title = runtime.title || def.title || chartKey;
  runtime.actions = Array.isArray(runtime.actions) ? runtime.actions : [];
  const hasExpandedControl = Object.prototype.hasOwnProperty.call(def, 'expandedH');
  if (hasExpandedControl) {
    if (!(chartKey in expandedByKey)) {
      expandedByKey[chartKey] = Boolean(def.expandedH);
    }
    runtime.expandedH = Boolean(expandedByKey[chartKey]);
  }
  runtime.ctx = createChartContext(chartKey);
  chartRuntimeMap.set(chartKey, runtime);
  return runtime;
};

const disposeChart = (chartKey) => {
  const runtime = chartRuntimeMap.get(chartKey);
  if (runtime && typeof runtime.dispose === 'function') {
    try {
      runtime.dispose();
    } catch (error) {
      logError('图表销毁钩子异常', chartKey, error);
    }
  }
  const instance = chartInstanceMap.get(chartKey);
  if (instance && typeof instance.dispose === 'function') {
    instance.dispose();
  }
  chartInstanceMap.delete(chartKey);
  chartSizeMap.delete(chartKey);
  if (runtime) runtime.instance = null;
};

const disposeAllCharts = () => {
  for (const key of chartInstanceMap.keys()) {
    disposeChart(key);
  }
};

const resizeChart = (chartKey) => {
  const runtime = chartRuntimeMap.get(chartKey);
  if (runtime && typeof runtime.resize === 'function') {
    try {
      const handled = runtime.resize();
      if (handled !== false) {
        return;
      }
    } catch (error) {
      logError('图表尺寸钩子异常', chartKey, error);
    }
  }

  const instance = chartInstanceMap.get(chartKey);
  if (!instance?.resize) return;
  instance.resize();
};

const getChartSizeKey = (chartKey) => {
  const el = chartDomMap[chartKey];
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  const rect = el.getBoundingClientRect();
  return `${Math.round(rect.width || 0)}x${Math.round(rect.height || 0)}`;
};

const removeCustomChart = (chartKey) => {
  const idx = chartDefs.value.findIndex((item) => item.key === chartKey && item.isCustom);
  if (idx < 0) return;
  chartDefs.value.splice(idx, 1);
  const visibleIdx = visibleChartKeys.value.indexOf(chartKey);
  if (visibleIdx >= 0) visibleChartKeys.value.splice(visibleIdx, 1);
  disposeChart(chartKey);
  chartRuntimeMap.delete(chartKey);
  delete expandedByKey[chartKey];

  const customStore = storage.get('charts.custom', {});
  if (customStore && customStore[chartKey]) {
    delete customStore[chartKey];
    storage.set('charts.custom', customStore);
  }
  if (customChartCodeMap.value[chartKey]) {
    delete customChartCodeMap.value[chartKey];
    customChartCodeMap.value = { ...customChartCodeMap.value };
  }
  storage.set('charts.visible', visibleChartKeys.value);
  emitChartMenus();
};

const normalizeChartMenuItem = (chartKey, runtime, rawMenu) => {
  if (!rawMenu || typeof rawMenu !== 'object') return null;
  return {
    ...rawMenu,
    chart: chartKey,
    getName: typeof rawMenu.getName === 'function'
      ? (item) => rawMenu.getName.call(runtime, item)
      : rawMenu.getName,
    onSelect: typeof rawMenu.onSelect === 'function'
      ? (item) => rawMenu.onSelect.call(runtime, item)
      : rawMenu.onSelect,
  };
};

const buildChartMenus = () => {
  const menus = [];
  for (const chartKey of visibleChartKeys.value) {
    const runtime = ensureRuntime(chartKey);
    if (!runtime) continue;

    const staticMenus = Array.isArray(runtime.menuItems) ? runtime.menuItems : [];
    const dynamicMenus = typeof runtime.getMenuItems === 'function'
      ? runtime.getMenuItems.call(runtime)
      : [];

    for (const menu of [...staticMenus, ...(Array.isArray(dynamicMenus) ? dynamicMenus : [])]) {
      const normalized = normalizeChartMenuItem(chartKey, runtime, menu);
      if (normalized) menus.push(normalized);
    }
  }
  return menus;
};

const emitChartMenus = () => {
  emit('update:chartMenus', buildChartMenus());
};

const parseCustomChartCode = (code) => {
  const chartDef = eval(`(${code})`);
  if (!chartDef || typeof chartDef !== 'object') {
    throw new Error('图表代码不是对象');
  }
  if (typeof chartDef.render !== 'function') {
    throw new Error('图表缺少 render 方法');
  }
  const baseName = sanitizeChartName(chartDef.name || chartDef.key || `chart_${Date.now()}`);
  if (!baseName) {
    throw new Error('图表名称无效');
  }
  const chartKey = baseName.startsWith('custom_') ? baseName : `custom_${baseName}`;
  return {
    ...chartDef,
    key: chartKey,
    title: chartDef.title || chartKey,
    actions: Array.isArray(chartDef.actions) ? chartDef.actions : [],
    instance: null,
    ctx: null,
    isCustom: true,
  };
};

const addCustomChart = () => {
  const code = String(newChartCode.value || '').trim();
  if (!code) return '';
  try {
    const def = parseCustomChartCode(code);
    const existingIndex = chartDefs.value.findIndex((item) => item.key === def.key);
    if (existingIndex >= 0) {
      const existing = chartDefs.value[existingIndex];
      if (!existing?.isCustom) {
        throw new Error(`不能覆盖默认图表：${def.key}`);
      }
      disposeChart(def.key);
      chartRuntimeMap.delete(def.key);
      chartDefs.value.splice(existingIndex, 1, def);
    } else {
      chartDefs.value.push(def);
      if (!visibleChartKeys.value.includes(def.key)) {
        visibleChartKeys.value.push(def.key);
      }
    }

    const customStore = storage.get('charts.custom', {});
    customStore[def.key] = code;
    storage.set('charts.custom', customStore);
    customChartCodeMap.value = {
      ...customChartCodeMap.value,
      [def.key]: code,
    };
    storage.set('charts.visible', visibleChartKeys.value);
    emitChartMenus();
    nextTick(() => renderChart(def.key));
    return def.key;
  } catch (error) {
    const message = String(error?.message || error || '未知错误');
    messageApi.error(`添加失败：${message}`);
    logError(error);
    return '';
  }
};

const initCharts = () => {
  customChartCodeMap.value = {};
  chartDefs.value = defaultCharts.map((def) => ({ ...def, isCustom: false }));

  const customStore = storage.get('charts.custom', {});
  Object.entries(customStore || {}).forEach(([key, code]) => {
    try {
      const parsed = parseCustomChartCode(code);
      if (parsed.key !== key) parsed.key = key;
      parsed.title = parsed.title || key;
      chartDefs.value.push(parsed);
      customChartCodeMap.value[key] = String(code || '');
    } catch (error) {
      const message = String(error?.message || error || '未知错误');
      messageApi.error(`图表 ${key} 加载失败：${message}`);
      logError('加载自定义图表失败', key, error);
    }
  });

  const storedVisible = storage.get('charts.visible', null);
  const allKeys = chartDefs.value.map((d) => d.key);
  if (Array.isArray(storedVisible) && storedVisible.length) {
    visibleChartKeys.value = storedVisible.filter((key) => allKeys.includes(key));
  } else {
    const preferred = ['user', 'wordcloud', 'density'];
    visibleChartKeys.value = preferred.filter((key) => allKeys.includes(key));
  }
  if (!visibleChartKeys.value.length && allKeys.length) {
    visibleChartKeys.value = [allKeys[0]];
  }
  emitChartMenus();
};

const resolveSelection = (def, runtime, params) => {
  const raw = typeof def.selection === 'function'
    ? def.selection.call(runtime, params)
    : def.selection;
  if (!raw || typeof raw !== 'object') return null;
  return raw;
};

const runChartClick = async (chartKey, params) => {
  const def = chartDefMap.value.get(chartKey);
  const runtime = ensureRuntime(chartKey);
  if (!def || !runtime) return;

  if (typeof def.onClick === 'function') {
    runtime.instance = chartInstanceMap.get(chartKey);
    await Promise.resolve(def.onClick.call(runtime, { params }));
    return;
  }

  const selection = resolveSelection(def, runtime, params);
  if (selection?.predicate) {
    const getValue = typeof selection.getValue === 'function'
      ? (p) => selection.getValue.call(runtime, p)
      : (p) => p?.name;
    const value = getValue(params);
    if (value == null || value === '') return;
    const formatValue = typeof selection.formatValue === 'function'
      ? (v) => selection.formatValue.call(runtime, v)
      : (v) => String(v);
    const predicate = (item, v) => selection.predicate.call(runtime, item, v);
    emit('select-filter', {
      source: selection.source || `chart:${chartKey}`,
      template: selection.template || '{value}',
      value,
      formatValue,
      predicate,
      wrapTag: selection.wrapTag !== false,
    });
  }
};

const renderChart = async (chartKey) => {
  const pending = chartRenderTaskMap.get(chartKey);
  await nextTick();
  if (pending) {
    await pending;
  }

  const task = (async () => {
    if (!echartsLib.value) return;
    const def = chartDefMap.value.get(chartKey);
    const runtime = ensureRuntime(chartKey);
    const el = chartDomMap[chartKey];
    if (!def || !el || !runtime) return;

    try {
      if (typeof runtime.init === 'function') {
        await Promise.resolve(runtime.init.call(runtime));
      }

      let instance = chartInstanceMap.get(chartKey);
      if (!instance && !runtime.noInstance) {
        instance = echartsLib.value.init(el, echartsTheme.value);
        chartInstanceMap.set(chartKey, instance);
      }

      if (instance) {
        instance.off('click');
        if (typeof def.onClick === 'function' || typeof def.selection === 'function' || def.selection?.predicate) {
          instance.on('click', (params) => {
            runChartClick(chartKey, params).catch((error) => logError(error));
          });
        }
        const baseOption = {
          title: { left: 'left', top: 'top' },
        };
        if (applyToCharts.value) {
          const colors = ensureChartColors();
          if (colors.length) baseOption.color = colors;
        }
        instance.setOption(baseOption);
      }

      runtime.instance = instance;
      await Promise.resolve(runtime.render.call(runtime));
      const sizeKey = getChartSizeKey(chartKey);
      if (sizeKey) chartSizeMap.set(chartKey, sizeKey);
    } catch (error) {
      logError('图表渲染异常', chartKey, error);
    }
  })();

  chartRenderTaskMap.set(chartKey, task);

  try {
    await nextTick();
    await task;
  } finally {
    if (chartRenderTaskMap.get(chartKey) === task) {
      chartRenderTaskMap.delete(chartKey);
    }
  }
};

const enqueueRender = (task) => {
  renderQueue = renderQueue
    .then(() => task())
    .catch((error) => {
      logError('图表渲染队列异常', error);
    });
  return renderQueue;
};

const renderAllCharts = async () => {
  await nextTick();
  for (const key of visibleChartKeys.value) {
    try {
      await renderChart(key);
    } catch (error) {
      logError('图表渲染失败', key, error);
    }
  }
};

const moveUp = async (chartKey) => {
  const current = visibleChartKeys.value;
  const index = current.indexOf(chartKey);
  if (index <= 0) return;
  const next = [...current];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  visibleChartKeys.value = next;
  storage.set('charts.visible', visibleChartKeys.value);
  emitChartMenus();
  await nextTick();
  const el = chartDomMap[chartKey];
  if (el?.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

const moveDown = async (chartKey) => {
  const current = visibleChartKeys.value;
  const index = current.indexOf(chartKey);
  if (index < 0 || index >= current.length - 1) return;
  const next = [...current];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  visibleChartKeys.value = next;
  storage.set('charts.visible', visibleChartKeys.value);
  emitChartMenus();
  await nextTick();
  const el = chartDomMap[chartKey];
  if (el?.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

const closeChart = (chartKey) => {
  const index = visibleChartKeys.value.indexOf(chartKey);
  if (index < 0) return;
  visibleChartKeys.value.splice(index, 1);
  storage.set('charts.visible', visibleChartKeys.value);
  emitChartMenus();
  disposeChart(chartKey);
};

const toggleExpand = async (chartKey) => {
  const runtime = ensureRuntime(chartKey);
  if (!runtime || !('expandedH' in runtime)) return;
  expandedByKey[chartKey] = !Boolean(expandedByKey[chartKey]);
  runtime.expandedH = Boolean(expandedByKey[chartKey]);
  await nextTick();
  const nextSize = getChartSizeKey(chartKey);
  if (nextSize) chartSizeMap.set(chartKey, nextSize);
  resizeChart(chartKey);
};

const getItemHeight = (chartKey) => {
  ensureRuntime(chartKey);
  return Boolean(expandedByKey[chartKey]) ? '100%' : '50%';
};

const runCustomAction = async (chartKey, action) => {
  const runtime = ensureRuntime(chartKey);
  if (!runtime) return;
  runtime.instance = chartInstanceMap.get(chartKey);

  if (typeof action.handler === 'function') {
    await Promise.resolve(action.handler.call(runtime));
    return;
  }
  if (action.method && typeof runtime[action.method] === 'function') {
    await Promise.resolve(runtime[action.method]());
  }
};

const refreshChart = async (chartKey) => {
  disposeChart(chartKey);
  await nextTick();
  await renderChart(chartKey);
};

const getActionList = (chartKey, index) => {
  const runtime = ensureRuntime(chartKey);
  const list = [];
  list.push({ key: 'remove', icon: '⨉', title: '移除图表', handler: () => closeChart(chartKey) });
  list.push({
    key: 'move-down',
    icon: '▼',
    title: '下移图表',
    disabled: index >= visibleChartKeys.value.length - 1,
    handler: () => moveDown(chartKey),
  });
  list.push({
    key: 'move-up',
    icon: '▲',
    title: '上移图表',
    disabled: index === 0,
    handler: () => moveUp(chartKey),
  });
  if (runtime && 'refresh' in runtime) {
    list.push({ key: 'refresh', icon: '↻', title: '刷新图表', handler: () => refreshChart(chartKey) });
  }
  if (runtime && 'expandedH' in runtime) {
    list.push({
      key: 'expand',
      icon: '⇕',
      title: '展开/收起',
      handler: () => toggleExpand(chartKey),
    });
  }

  const customActions = runtime?.actions || [];
  for (const action of customActions) {
    const icon = typeof action.icon === 'function' ? action.icon(runtime) : (action.icon || '•');
    list.push({
      key: `custom-${action.key || action.method}`,
      icon,
      title: action.title || action.key || action.method,
      handler: () => runCustomAction(chartKey, action),
    });
  }
  return list;
};

const chartResize = () => {
  for (const key of visibleChartKeys.value) {
    const nextSize = getChartSizeKey(key);
    if (!nextSize) continue;
    if (chartSizeMap.get(key) === nextSize) continue;
    chartSizeMap.set(key, nextSize);
    resizeChart(key);
  }
};

watch(
  () => props.items,
  () => {
    enqueueRender(renderAllCharts);
  },
);

watch(
  () => echartsTheme.value,
  () => {
    chartColors.value = [];
    for (const instance of chartInstanceMap.values()) {
      if (!instance || typeof instance.setTheme !== 'function') continue;
      try {
        instance.setTheme(echartsTheme.value);
      } catch (error) {
        logError('图表切换主题失败', error);
      }
    }
    enqueueRender(renderAllCharts);
  },
);

watch(
  () => [applyToCharts.value, activePrimaryColor.value],
  ([nextApplyToCharts], [prevApplyToCharts]) => {
    chartColors.value = [];
    if (prevApplyToCharts && !nextApplyToCharts) {
      disposeAllCharts();
    }
    enqueueRender(renderAllCharts);
  },
);

watch(
  () => visibleChartKeys.value.slice(),
  (current, prev = []) => {
    enqueueRender(async () => {
      const prevSet = new Set(prev);
      const currentSet = new Set(current);

      await nextTick();
      for (const key of prev) {
        if (!currentSet.has(key)) disposeChart(key);
      }
      for (const key of current) {
        if (!prevSet.has(key)) {
          try {
            await renderChart(key);
          } catch (error) {
            logError('新增图表渲染失败', key, error);
          }
        }
      }
      storage.set('charts.visible', current);

      emitChartMenus();
    });
  },
  { deep: false },
);

watch(
  () => chartDefs.value.map((item) => item.key).join(','),
  () => {
    const validSet = new Set(chartDefs.value.map((item) => item.key));
    visibleChartKeys.value = visibleChartKeys.value.filter((key) => validSet.has(key));
    emitChartMenus();
  },
);

onMounted(async () => {
  initCharts();
  window.addEventListener('resize', chartResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', chartResize);
  disposeAllCharts();
});

defineExpose({
  chartResize,
  chartBodyEl: chartBodyRef,
  settings: {
    chartDefs,
    customCharts,
    visibleChartKeys,
    newChartCode,
    addCustomChart,
    removeCustomChart,
    getCustomChartCode: (chartKey) => customChartCodeMap.value[chartKey] || '',
  },
});
</script>

<template>
  <div class="bds-dm-chart-manager">
    <n-alert v-if="!echartsLib" type="error" title="ECharts 未加载，无法渲染图表" />
    <n-empty v-if="!hasChart" description="暂无已启用图表" class="bds-dm-chart-manager__empty" />
    <div style="display: none;" ref="chartTestRef"></div>

    <div ref="chartBodyRef" class="bds-dm-chart-manager__body">
      <div v-for="(chartKey, index) in visibleChartKeys" :key="chartKey" class="bds-dm-chart-manager__item"
        :style="{ '--item-height': getItemHeight(chartKey) }" @mouseenter="chartHover = chartKey"
        @mouseleave="chartHover = null">
        <div v-if="chartHover === chartKey" class="bds-dm-chart-manager__actions">
          <button v-for="action in getActionList(chartKey, index)" :key="`${chartKey}:${action.key}`"
            class="bds-dm-chart-manager__action-btn" type="button" :title="action.title" :disabled="action.disabled"
            @click="action.handler">
            {{ action.icon }}
          </button>
          <span />
        </div>

        <div :ref="(el) => (chartDomMap[chartKey] = el)" class="bds-dm-chart-manager__chart" />
      </div>
    </div>
  </div>
</template>
