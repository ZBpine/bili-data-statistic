<script setup>
import { nextTick } from 'vue';
import { Camera, RefreshDot, GridDots } from '@vicons/tabler';
import { useThemeVars } from 'naive-ui';
import { layoutFlowGraph } from '../../utils/graphLayout';

const props = defineProps({
  graphLoading: {
    type: Boolean,
    default: false,
  },
  getGraph: {
    type: Function,
    required: true,
  },
  getEcharts: {
    type: Function,
    required: true,
  },
  aspectRatio: {
    type: Number,
    default: 2,
  },
});
const emit = defineEmits(['graph-click', 'graph-capture']);

const themeVars = useThemeVars();
const baseGap = 60;
const baseSpan = ref(4);

const normalizedAspectRatio = computed(() => {
  const ratio = Number(props.aspectRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 3;
});

const graphElStyle = computed(() => {
  return {
    width: '100%',
    aspectRatio: `${normalizedAspectRatio.value} / 1`,
  };
});

const direction = ref('LR');
const dedupe = ref(false);
const showOptions = ref(false);
const removeBackEdges = ref(false);
const capturing = ref(false);
const currentScale = ref(1);
const graphElRef = ref(null);
const graphMapRef = shallowRef({});
const edgeMetaMapRef = shallowRef({});
const varsMapRef = shallowRef({});
let graphInstance = null;

const prettifyMathAssign = (text) => {
  return String(text || '')
    .replace(/([^=;\s]+)\s*=\s*\1\s*\+\s*([^;]+)/g, '$1+$2')
    .replace(/([^=;\s]+)\s*=\s*\1\s*-\s*([^;]+)/g, '$1-$2');
};

const formatExpression = (text, varsMap) => {
  return String(text || '')
    .replace(/\$[A-Za-z0-9_]+/g, (match) => String(varsMap?.[match]?.name || match))
    .replace(/\b(-?\d+)\.00\b/g, '$1')
    .replace(/\s*&&\s*/g, ' 且 ')
    .replace(/\s*\|\|\s*/g, ' 或 ')
    .replace(/\s*!=\s*/g, ' ≠ ')
    .replace(/\s*==\s*/g, ' = ')
    .trim();
};

const formatActionExpression = (text, varsMap) => {
  const chunks = String(text || '')
    .split(';')
    .map((item) => prettifyMathAssign(item).trim())
    .filter(Boolean)
    .map((item) => formatExpression(item, varsMap));
  return chunks.join('；');
};

const formatEdgeTooltip = (params) => {
  if (params?.dataType !== 'edge') return '';
  const meta = params?.data?.meta;
  if (!meta || typeof meta !== 'object') return '';
  const action = formatActionExpression(meta?.action, varsMapRef.value);
  const condition = formatExpression(meta?.condition, varsMapRef.value);
  if (!action && !condition) return '';
  const lines = [];
  if (condition) lines.push(`条件：${condition}`);
  if (action) lines.push(`行为：${action}`);
  return lines.join('<br/>');
};

const handleGraphClick = (params) => {
  emit('graph-click', params?.data?.value);
};

const ensureGraphInstance = async () => {
  if (graphInstance) return graphInstance;
  await nextTick();
  const el = graphElRef.value;
  const echarts = await props.getEcharts();
  if (!el || !echarts?.init) return null;
  graphInstance = echarts.init(el);
  graphInstance.on('click', handleGraphClick);
  return graphInstance;
};

const renderByGraphMap = async (graphMap) => {
  const instance = await ensureGraphInstance();
  if (!instance) return;
  const graph = layoutFlowGraph(graphMap || {}, {
    rootId: 1,
    direction: direction.value,
    mode: 'compact',
    layoutRatio: normalizedAspectRatio.value,
    baseGap,
    baseSpan: baseSpan.value,
    removeBackEdges: removeBackEdges.value,
    edgeMetaMap: edgeMetaMapRef.value,
  });
  currentScale.value = Number(graph?.meta?.scale) || 1;
  instance.setOption({
    tooltip: {
      show: true,
      formatter: formatEdgeTooltip,
    },
    series: [
      {
        type: 'graph',
        layout: 'none',
        roam: true,
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [4, 10],
        label: {
          show: true,
          formatter: (params) => params?.data?.name || params?.data?.id || '',
        },
        itemStyle: {
          color: themeVars.value.primaryColor,
          borderRadius: 8,
        },
        lineStyle: {
          width: 1.5,
          opacity: 0.85,
        },
        emphasis: {
          focus: 'adjacency',
          itemStyle: {
            opacity: 1,
          },
          lineStyle: {
            width: 2,
            opacity: 1,
          },
          edgeLabel: {
            show: true,
            formatter: (params) => params?.data?.label || '',
          },
        },
        blur: {
          itemStyle: {
            opacity: 0.25,
          },
          lineStyle: {
            opacity: 0.18,
          },
        },
        edgeLabel: {
          show: showOptions.value,
          formatter: (params) => params?.data?.label || '',
        },
        data: Array.isArray(graph.data) ? graph.data : [],
        links: Array.isArray(graph.links) ? graph.links : [],
      },
    ],
  });
  instance.resize();
};

const refresh = async () => {
  const payload = await props.getGraph(dedupe.value) || {};
  const graphMap = payload.graphMap || {};
  const edgeMetaMap = payload?.edgeMetaMap || {};
  const varsMap = payload?.varsMap || {};
  graphMapRef.value = graphMap;
  edgeMetaMapRef.value = edgeMetaMap;
  varsMapRef.value = varsMap;
  await renderByGraphMap(graphMap);
};

const updateBaseSpan = () => {
  const height = Number(graphElRef.value?.clientHeight || 0);
  const nextSpan = Math.max(1, Math.round(height / baseGap));
  if (baseSpan.value === nextSpan) return false;
  baseSpan.value = nextSpan;
  return true;
};

const setBaseSpan = async (value) => {
  const next = Number(value);
  if (!Number.isFinite(next) || next < 1) return;
  if (baseSpan.value === next) return;
  baseSpan.value = next;
  await refresh();
};

const handleWindowResize = () => {
  if (!updateBaseSpan()) return;
  refresh().catch(() => { });
};

const dispose = () => {
  if (graphInstance?.off) {
    graphInstance.off('click', handleGraphClick);
  }
  if (graphInstance?.dispose) {
    graphInstance.dispose();
  }
  graphInstance = null;
};

const setDirection = async (next) => {
  const value = next === 'TB' ? 'TB' : 'LR';
  if (direction.value === value) return;
  direction.value = value;
  await refresh();
};

const setDedupe = async (checked) => {
  const value = Boolean(checked);
  if (dedupe.value === value) return;
  dedupe.value = value;
  await refresh();
};

const setShowOptions = async (checked) => {
  const value = Boolean(checked);
  if (showOptions.value === value) return;
  showOptions.value = value;
  const instance = await ensureGraphInstance();
  if (!instance) return;
  instance.setOption({
    series: [
      {
        edgeLabel: {
          show: showOptions.value,
        },
      },
    ],
  });
  instance.resize();
};

const setRemoveBackEdges = async (checked) => {
  const value = Boolean(checked);
  if (removeBackEdges.value === value) return;
  removeBackEdges.value = value;
  await refresh();
};

const resetView = async () => {
  const instance = await ensureGraphInstance();
  if (!instance) return;
  const center = direction.value === 'TB' ? ['50%', '0'] : ['0', '50%'];
  instance.setOption({
    series: [
      {
        center,
        zoom: currentScale.value,
      },
    ],
  });
  instance.resize();
};

const captureGraph = async () => {
  if (capturing.value) return;
  const echarts = await props.getEcharts();
  if (!echarts?.init) return;
  const graph = layoutFlowGraph(graphMapRef.value || {}, {
    rootId: 1,
    direction: direction.value,
    mode: 'layout',
    layoutRatio: normalizedAspectRatio.value,
    baseGap,
    baseSpan: baseSpan.value,
    maxArea: 100_000_000,
    removeBackEdges: removeBackEdges.value,
    edgeMetaMap: edgeMetaMapRef.value,
  });
  const data = Array.isArray(graph.data) ? graph.data : [];
  const links = Array.isArray(graph.links) ? graph.links : [];
  if (!data.length) return;
  const width = Number(graph?.meta?.viewport?.width || 0);
  const height = Number(graph?.meta?.viewport?.height || 0);
  if (!width || !height) return;
  // console.log('[interactive graph capture]', graph.meta.viewport); //上限面积约119,305,048
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '120vw';
  el.style.top = '120vh';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  document.body.appendChild(el);

  let exportChart = null;
  try {
    capturing.value = true;
    await nextTick();
    await new Promise(requestAnimationFrame);
    exportChart = echarts.init(el);
    exportChart.setOption({
      animation: false,
      tooltip: {
        show: true,
        formatter: formatEdgeTooltip,
      },
      series: [
        {
          type: 'graph',
          layout: 'none',
          roam: false,
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: [4, 10],
          label: {
            show: true,
            formatter: (params) => params?.data?.name || params?.data?.id || '',
          },
          itemStyle: {
            color: themeVars.value.primaryColor,
            borderRadius: 8,
          },
          lineStyle: {
            width: 1.5,
            opacity: 0.85,
          },
          edgeLabel: {
            show: showOptions.value,
            formatter: (params) => params?.data?.label || '',
          },
          data,
          links,
        },
      ],
    });

    const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
    const dataUrl = exportChart.getDataURL({
      type: 'png',
      pixelRatio,
      backgroundColor: themeVars.value.cardColor,
    });
    emit('graph-capture', dataUrl);
  } finally {
    capturing.value = false;
    exportChart?.dispose?.();
    document.body.removeChild(el);
  }
};

defineExpose({
  refresh,
  dispose,
  resize: () => graphInstance?.resize?.(),
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
  dispose();
});

onMounted(() => {
  nextTick(() => {
    updateBaseSpan();
    refresh().catch(() => { });
  });
  window.addEventListener('resize', handleWindowResize);
});
</script>

<template>
  <n-flex vertical :size="8" style="height: 100%; min-height: 0;">
    <n-flex :size="8" align="center" wrap>
      <n-flex :size="8" align="center" wrap>
        <n-button size="small" circle title="回到开头" :disabled="graphLoading" @click="resetView">
          <template #icon>
            <n-icon>
              <refresh-dot />
            </n-icon>
          </template>
        </n-button>
        <n-radio-group :value="direction" size="small" :disabled="graphLoading" @update:value="setDirection">
          <n-radio-button value="LR">水平</n-radio-button>
          <n-radio-button value="TB">垂直</n-radio-button>
        </n-radio-group>
        <n-input-number :value="baseSpan" size="small" :min="1" style="width: 110px;" :disabled="graphLoading"
          @update:value="setBaseSpan" title="密度">
          <template #prefix>
            <n-icon>
              <grid-dots />
            </n-icon>
          </template>
        </n-input-number>
      </n-flex>
      <n-flex :size="8" align="center" wrap>
        <n-checkbox :checked="dedupe" :disabled="graphLoading" @update:checked="setDedupe">
          去重
        </n-checkbox>
        <n-checkbox :checked="showOptions" @update:checked="setShowOptions">
          显示选项
        </n-checkbox>
        <n-checkbox :checked="removeBackEdges" :disabled="graphLoading" @update:checked="setRemoveBackEdges">
          隐藏回边
        </n-checkbox>
      </n-flex>
      <n-button size="small" circle style="margin-left: auto;" :loading="capturing"
        :disabled="graphLoading || capturing" @click="captureGraph" title="密度越小截图越大">
        <template #icon>
          <n-icon>
            <camera />
          </n-icon>
        </template>
      </n-button>
    </n-flex>
    <div ref="graphElRef" :style="graphElStyle"></div>
  </n-flex>
</template>
