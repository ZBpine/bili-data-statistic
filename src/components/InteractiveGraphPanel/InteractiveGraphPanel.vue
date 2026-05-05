<script setup>
import mountStyle from './style.cssr.js';
import { nextTick } from 'vue';
import { Camera, RefreshDot, GridDots, Viewfinder, CircleX, ArrowsSplit2, ArrowsJoin2, Variable } from '@vicons/tabler';
import { useThemeVars } from 'naive-ui';
import { layoutFlowGraph } from '../../utils/graphLayout';
import { getStringSimilarity } from '../../utils/utils';

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);

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
const localAspectRatio = ref(null);

const normalizedAspectRatio = computed(() => {
  const ratio = Number(localAspectRatio.value ?? props.aspectRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 3;
});

const cssVars = computed(() => ({
  '--bds-interactive-graph-aspect': `${normalizedAspectRatio.value} / 1`,
  '--bds-interactive-graph-hover-color': themeVars.value.hoverColor,
}));

const direction = ref('LR');
const layoutMode = ref('spread');
const createDefaultPasses = (useSpread) => {
  const next = [
    { reference: 'prev', spread: false },
    { reference: 'next', spread: false },
    { reference: 'prev', spread: false },
  ];
  if (useSpread) {
    next.push(
      { reference: 'both', spread: true },
      { reference: 'both', spread: true },
    );
  }
  return next;
};
const normalizePass = (pass = {}) => {
  const reference = String(pass?.reference || '').toLowerCase();
  return {
    reference: ['prev', 'next', 'both'].includes(reference) ? reference : 'both',
    spread: Boolean(pass?.spread),
  };
};
const passReferenceOptions = [
  { label: 'prev', value: 'prev' },
  { label: 'next', value: 'next' },
  { label: 'both', value: 'both' },
];
const layoutPasses = ref(createDefaultPasses(true));
const dedupe = ref(false);
const showOptions = ref(false);
const removeBackEdges = ref(false);
const capturing = ref(false);
const focusMode = ref(false);
const currentScale = ref(1);
const panelElRef = ref(null);
const graphElRef = ref(null);
const showDrawer = ref(false);
const graphMapRef = shallowRef({});
const varsMapRef = shallowRef({});
const hiddenVarMap = ref({});
const currentGraphRef = shallowRef({ data: [], links: [] });
let graphInstance = null;
const hasVariables = computed(() => Object.keys(varsMapRef.value || {}).length > 0);
const hiddenVarItems = computed(() => {
  const varsMap = varsMapRef.value || {};
  const sorted = Object.keys(varsMap)
    .map((key) => ({
      key,
      label: String(varsMap?.[key]?.name || key),
      checked: Boolean(hiddenVarMap.value?.[key]),
    }))
    .sort((a, b) => (a.label.localeCompare(b.label, 'zh-Hans-CN')) || a.key.localeCompare(b.key));

  const numericNamePattern = /^数值(\d+)$/;
  const normalItems = [];
  const numericItems = [];
  for (const item of sorted) {
    const matched = numericNamePattern.exec(item.label);
    if (!matched) {
      normalItems.push(item);
      continue;
    }
    numericItems.push({
      ...item,
      numericIndex: Number(matched[1]),
    });
  }

  const orderBySimilarity = (items) => {
    if (items.length <= 2) return [...items];

    const ordered = [items[0]];
    const rest = items.slice(1);
    while (rest.length) {
      const last = ordered[ordered.length - 1];
      let bestIndex = 0;
      let bestScore = getStringSimilarity(last.label, rest[0].label);
      for (let i = 1; i < rest.length; i += 1) {
        const score = getStringSimilarity(last.label, rest[i].label);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      ordered.push(rest.splice(bestIndex, 1)[0]);
    }

    return ordered;
  };

  const orderedNormalItems = orderBySimilarity(normalItems);
  numericItems.sort((a, b) => (a.numericIndex - b.numericIndex) || a.key.localeCompare(b.key));

  return [...orderedNormalItems, ...numericItems.map(({ numericIndex, ...item }) => item)];
});

const FOCUS_OPACITY = 0.95;
const DIM_OPACITY = 0.14;
const FOCUS_NODE_OPACITY = 1;
const DIM_NODE_OPACITY = 0.2;
const VAR_TOKEN_REGEXP = /\$[A-Za-z0-9_]+/g;

const nodeShadowBlur = 16;
const edgeShadowBlur = 4;
let dragPointerId = null;
let dragStartY = 0;
let dragStartHeight = 0;
let draggingResize = false;

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
  const value = params?.data?.value;
  if (!value || typeof value !== 'object') return '';
  const action = formatActionExpression(value?.action, varsMapRef.value);
  const condition = formatExpression(value?.condition, varsMapRef.value);
  if (!action && !condition) return '';
  const lines = [];
  if (condition) lines.push(`条件：${condition}`);
  if (action) lines.push(`行为：${action}`);
  return lines.join('<br/>');
};

const escapeRegExp = (text) => String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractVars = (text) => {
  const matches = String(text || '').match(VAR_TOKEN_REGEXP) || [];
  return new Set(matches.filter(Boolean));
};

const getLinkKey = (linkLike) => {
  const source = String(linkLike?.source || '');
  const target = String(linkLike?.target || '');
  const value = linkLike?.value || {};
  const option = String(value?.option || '');
  const action = String(value?.action || '');
  const condition = String(value?.condition || '');
  return `${source}|${target}|${option}|${action}|${condition}`;
};

const clearEdgeHighlight = async () => {
  const instance = await ensureGraphInstance();
  if (!instance) return;
  const data = Array.isArray(currentGraphRef.value?.data) ? currentGraphRef.value.data : [];
  const links = Array.isArray(currentGraphRef.value?.links) ? currentGraphRef.value.links : [];
  instance.setOption({
    series: [
      {
        data,
        links,
      },
    ],
  });
};

const matchAction = (inputText) => {
  const links = Array.isArray(currentGraphRef.value?.links) ? currentGraphRef.value.links : [];
  const vars = [...extractVars(inputText)].filter(Boolean);
  const patterns = vars.map((token) => new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(token)}([^A-Za-z0-9_]|$)`));
  const matchedEdgeKeys = new Set();
  const matchedSourceNodeIds = new Set();
  for (const link of links) {
    const action = String(link?.value?.action || '');
    const matched = patterns.some((pattern) => pattern.test(action));
    if (!matched) continue;
    matchedEdgeKeys.add(getLinkKey(link));
    matchedSourceNodeIds.add(String(link?.source || ''));
  }
  return { matchedEdgeKeys, matchedSourceNodeIds };
};

const matchCondition = (inputText) => {
  const links = Array.isArray(currentGraphRef.value?.links) ? currentGraphRef.value.links : [];
  const vars = [...extractVars(inputText)].filter(Boolean);
  const patterns = vars.map((token) => new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(token)}([^A-Za-z0-9_]|$)`));
  const matchedEdgeKeys = new Set();
  const matchedTargetNodeIds = new Set();
  for (const link of links) {
    const condition = String(link?.value?.condition || '');
    const matched = patterns.some((pattern) => pattern.test(condition));
    if (!matched) continue;
    matchedEdgeKeys.add(getLinkKey(link));
    matchedTargetNodeIds.add(String(link?.target || ''));
  }
  return { matchedEdgeKeys, matchedTargetNodeIds };
};

const setHiddenVarChecked = (key, checked) => {
  hiddenVarMap.value = {
    ...(hiddenVarMap.value || {}),
    [key]: Boolean(checked),
  };
};

const applyHiddenVarFocus = async () => {
  const selectedKeys = Object.keys(hiddenVarMap.value || {}).filter((key) => Boolean(hiddenVarMap.value?.[key]));
  if (!selectedKeys.length) {
    await clearEdgeHighlight();
    showDrawer.value = false;
    return;
  }
  const highlightEdgeKeys = new Set();
  const highlightNodeIds = new Set();
  for (const key of selectedKeys) {
    const actionMatched = matchAction(key);
    const conditionMatched = matchCondition(key);
    for (const edgeKey of actionMatched.matchedEdgeKeys) highlightEdgeKeys.add(edgeKey);
    for (const edgeKey of conditionMatched.matchedEdgeKeys) highlightEdgeKeys.add(edgeKey);
    for (const sourceId of actionMatched.matchedSourceNodeIds) highlightNodeIds.add(sourceId);
    for (const targetId of conditionMatched.matchedTargetNodeIds) highlightNodeIds.add(targetId);
  }
  await renderFocusState({
    highlightNodeIds,
    shadowNodeIds: new Set(),
    highlightEdgeKeys,
    shadowEdgeKeys: new Set(),
  });
  showDrawer.value = false;
};

const clearHiddenVarFocus = async () => {
  await clearEdgeHighlight();
  showDrawer.value = false;
};

const renderFocusState = async ({
  highlightNodeIds = new Set(),
  shadowNodeIds = new Set(),
  highlightEdgeKeys = new Set(),
  shadowEdgeKeys = new Set(),
} = {}) => {
  const instance = await ensureGraphInstance();
  if (!instance) return;
  const links = (Array.isArray(currentGraphRef.value?.links) ? currentGraphRef.value.links : []).map((link) => {
    const key = getLinkKey(link);
    const isHighlight = highlightEdgeKeys.has(key) || shadowEdgeKeys.has(key);
    const isShadow = shadowEdgeKeys.has(key);
    return {
      ...link,
      lineStyle: {
        ...(link?.lineStyle || {}),
        opacity: isHighlight ? FOCUS_OPACITY : DIM_OPACITY,
        shadowBlur: isShadow ? edgeShadowBlur : 0,
        shadowColor: isShadow ? themeVars.value.primaryColor : 'transparent',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      },
    };
  });
  const data = (Array.isArray(currentGraphRef.value?.data) ? currentGraphRef.value.data : []).map((node) => {
    const nodeId = String(node?.id || '');
    const isHighlight = highlightNodeIds.has(nodeId) || shadowNodeIds.has(nodeId);
    const isShadow = shadowNodeIds.has(nodeId);
    return {
      ...node,
      itemStyle: {
        ...(node?.itemStyle || {}),
        opacity: isHighlight ? FOCUS_NODE_OPACITY : DIM_NODE_OPACITY,
        shadowBlur: isShadow ? nodeShadowBlur : 0,
        shadowColor: isShadow ? themeVars.value.primaryColor : 'transparent',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      },
    };
  });
  instance.setOption({
    series: [
      {
        data,
        links,
      },
    ],
  });
};

const handleEdgeSelection = async (edgeData = {}) => {
  const edgeValue = edgeData?.value || {};
  const { matchedEdgeKeys, matchedSourceNodeIds } = matchAction(edgeValue?.condition);
  const shadowEdgeKeys = new Set([getLinkKey(edgeData)]);
  const shadowNodeIds = new Set();
  const highlightNodeIds = new Set(matchedSourceNodeIds);
  const selectedTargetId = String(edgeData?.target || '');
  if (selectedTargetId) highlightNodeIds.add(selectedTargetId);
  await renderFocusState({
    highlightNodeIds,
    shadowNodeIds,
    highlightEdgeKeys: matchedEdgeKeys,
    shadowEdgeKeys,
  });
};

const handleNodeSelection = async (nodeData = {}) => {
  const nodeValue = nodeData?.value || {};
  const inEdges = Array.isArray(nodeValue?.in) ? nodeValue.in : [];
  const highlightEdgeKeys = new Set();
  const shadowEdgeKeys = new Set();
  const highlightNodeIds = new Set();
  const shadowNodeIds = new Set();
  const selectedNodeId = String(nodeValue?.id || '');
  if (selectedNodeId) shadowNodeIds.add(selectedNodeId);

  for (const inEdge of inEdges) {
    const { matchedEdgeKeys, matchedSourceNodeIds } = matchAction(inEdge?.condition);
    if (!matchedEdgeKeys.size) continue;
    const incomingEdgeLike = {
      source: inEdge?.id,
      target: selectedNodeId,
      value: inEdge,
    };
    const incomingEdgeKey = getLinkKey(incomingEdgeLike);
    shadowEdgeKeys.add(incomingEdgeKey);
    for (const key of matchedEdgeKeys) highlightEdgeKeys.add(key);
    for (const id of matchedSourceNodeIds) highlightNodeIds.add(id);
  }

  await renderFocusState({
    highlightNodeIds,
    shadowNodeIds,
    highlightEdgeKeys,
    shadowEdgeKeys,
  });
};

const handleGraphClick = (params) => {
  if (focusMode.value) {
    if (params?.dataType === 'node') {
      handleNodeSelection(params?.data || {}).catch(() => { });
      return;
    }
    if (params?.dataType === 'edge') {
      handleEdgeSelection(params?.data || {}).catch(() => { });
      return;
    }
    return;
  }
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
    spread: layoutMode.value === 'spread',
    passes: layoutPasses.value,
    layoutRatio: normalizedAspectRatio.value,
    baseGap,
    baseSpan: baseSpan.value,
    removeBackEdges: removeBackEdges.value,
  });
  currentScale.value = Number(graph?.meta?.scale) || 1;
  currentGraphRef.value = graph;
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
            formatter: (params) => params?.data?.value?.option || '',
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
          formatter: (params) => params?.data?.value?.option || '',
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
  const varsMap = payload?.varsMap || {};
  const nextHiddenVarMap = {};
  for (const key of Object.keys(varsMap)) {
    nextHiddenVarMap[key] = Boolean(hiddenVarMap.value?.[key]);
  }
  graphMapRef.value = graphMap;
  varsMapRef.value = varsMap;
  hiddenVarMap.value = nextHiddenVarMap;
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

const handleAspectResizeMove = (event) => {
  event.preventDefault();
  if (!draggingResize || dragPointerId == null) return;
  if (event.pointerId !== dragPointerId) return;
  const width = Number(graphElRef.value?.clientWidth || 0);
  if (width <= 0) return;
  const deltaY = Number(event.clientY || 0) - dragStartY;
  const nextHeight = dragStartHeight + deltaY;
  if (nextHeight < width / 50) return;
  localAspectRatio.value = width / nextHeight;
};

const handleAspectResizeEnd = () => {
  if (!draggingResize) return;
  draggingResize = false;
  dragPointerId = null;
  window.removeEventListener('pointermove', handleAspectResizeMove);
  window.removeEventListener('pointerup', handleAspectResizeEnd);
  window.removeEventListener('pointercancel', handleAspectResizeEnd);
  refresh().catch(() => { });
};

const beginAspectResize = (event) => {
  event.preventDefault();
  const height = Number(graphElRef.value?.clientHeight || 0);
  if (height <= 0) return;
  dragPointerId = event.pointerId;
  dragStartY = Number(event.clientY || 0);
  dragStartHeight = height;
  draggingResize = true;
  window.addEventListener('pointermove', handleAspectResizeMove);
  window.addEventListener('pointerup', handleAspectResizeEnd);
  window.addEventListener('pointercancel', handleAspectResizeEnd);
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

const enableFocusMode = async () => {
  focusMode.value = true;
  await clearEdgeHighlight();
};

const disableFocusMode = async () => {
  focusMode.value = false;
  await clearEdgeHighlight();
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

const setLayoutMode = async (next) => {
  const value = next === 'spread' ? 'spread' : 'converge';
  if (layoutMode.value === value) return;
  layoutMode.value = value;
  layoutPasses.value = createDefaultPasses(value === 'spread');
  await refresh();
};

const setLayoutPasses = async (value) => {
  const list = Array.isArray(value) ? value.map((item) => normalizePass(item)) : [];
  layoutPasses.value = list.length ? list : createDefaultPasses(layoutMode.value === 'spread');
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

const resetLayoutPasses = async () => {
  layoutPasses.value = createDefaultPasses(layoutMode.value === 'spread');
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
    spread: layoutMode.value === 'spread',
    passes: layoutPasses.value,
    layoutRatio: normalizedAspectRatio.value,
    baseGap,
    baseSpan: baseSpan.value,
    maxArea: 100_000_000,
    removeBackEdges: removeBackEdges.value,
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
            formatter: (params) => params?.data?.value?.option || '',
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
  handleAspectResizeEnd();
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
  <div ref="panelElRef" class="bds-interactive-graph-panel" :style="cssVars">
    <n-flex vertical :size="8">
      <n-flex :size="8" align="center" wrap>
        <n-flex :size="8" :inline="true" align="center" wrap>
          <n-button size="small" circle title="回到开头" :disabled="graphLoading" @click="resetView">
            <template #icon>
              <n-icon>
                <refresh-dot />
              </n-icon>
            </template>
          </n-button>
          <n-radio-group :value="layoutMode" size="small" :disabled="graphLoading" @update:value="setLayoutMode">
            <n-radio-button value="spread" title="分散">
              <n-icon>
                <arrows-split2 />
              </n-icon>
            </n-radio-button>
            <n-radio-button value="converge" title="收束">
              <n-icon>
                <arrows-join2 />
              </n-icon>
            </n-radio-button>
          </n-radio-group>
          <n-radio-group :value="direction" size="small" :disabled="graphLoading" @update:value="setDirection">
            <n-radio-button value="LR">水平</n-radio-button>
            <n-radio-button value="TB">垂直</n-radio-button>
          </n-radio-group>
          <n-input-number :value="baseSpan" size="small" :min="1" class="bds-interactive-graph-panel__span-input"
            :disabled="graphLoading" @update:value="setBaseSpan" title="密度">
            <template #prefix>
              <n-icon>
                <grid-dots />
              </n-icon>
            </template>
          </n-input-number>
        </n-flex>
        <n-flex :size="8" :inline="true" align="center" wrap>
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
        <n-flex :size="8" :inline="true" align="center" wrap class="bds-interactive-graph-panel__action-right">
          <n-button v-if="hasVariables" size="small" circle :disabled="graphLoading" @click="showDrawer = true"
            title="查看隐藏变量">
            <template #icon>
              <n-icon>
                <variable />
              </n-icon>
            </template>
          </n-button>
          <n-button size="small" circle :loading="capturing" :disabled="graphLoading"
            @click="focusMode ? disableFocusMode() : enableFocusMode()" :title="focusMode ? '退出分析模式' : '进入分析模式'">
            <template #icon>
              <n-icon>
                <viewfinder v-if="!focusMode" />
                <circle-x v-else />
              </n-icon>
            </template>
          </n-button>
          <n-button size="small" circle :loading="capturing" :disabled="graphLoading || capturing" @click="captureGraph"
            title="密度越小截图越大">
            <template #icon>
              <n-icon>
                <camera />
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-flex>
      <div ref="graphElRef" class="bds-interactive-graph-panel__graph" :class="{ 'is-focus-mode': focusMode }"></div>
      <div class="bds-interactive-graph-panel__resize-handle" @pointerdown="beginAspectResize"></div>
    </n-flex>
    <n-drawer v-model:show="showDrawer" placement="right" :width="360" :to="panelElRef"
      :trap-focus="false" :block-scroll="false">
      <n-drawer-content title="隐藏变量" closable>
        <n-flex vertical :size="12">
          <n-flex vertical :size="8">
            <n-flex v-for="item in hiddenVarItems" :key="item.key" :inline="true" align="center" justify="space-between">
              <n-switch :value="item.checked" @update:value="(next) => setHiddenVarChecked(item.key, next)" />
              <span>{{ item.label }}</span>
            </n-flex>
          </n-flex>
          <n-flex :size="8" :inline="true" style="width: 100%">
            <div style="flex: 1">
              <n-button style="width: 100%" @click="applyHiddenVarFocus">查看</n-button>
            </div>
            <div style="flex: 1">
              <n-button style="width: 100%" @click="clearHiddenVarFocus">清除</n-button>
            </div>
          </n-flex>
          <!-- <n-dynamic-input :value="layoutPasses" :disabled="graphLoading" class="bds-interactive-graph-panel__passes"
            :on-create="() => ({ reference: 'both', spread: layoutMode === 'spread' })" @update:value="setLayoutPasses">
            <template #default="{ value, index }">
              <n-flex :size="6" :inline="true" align="center" wrap>
                <n-select size="small" :value="value.reference" :options="passReferenceOptions" style="width: 110px"
                  @update:value="(next) => setLayoutPasses(layoutPasses.map((item, itemIndex) => itemIndex === index ? { ...item, reference: next } : item))" />
                <n-switch size="small" :value="value.spread"
                  @update:value="(next) => setLayoutPasses(layoutPasses.map((item, itemIndex) => itemIndex === index ? { ...item, spread: next } : item))">
                  <template #checked>True</template>
                  <template #unchecked>False</template>
                </n-switch>
              </n-flex>
            </template>
          </n-dynamic-input>
          <n-button secondary @click="resetLayoutPasses">重置默认</n-button> -->
        </n-flex>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>
