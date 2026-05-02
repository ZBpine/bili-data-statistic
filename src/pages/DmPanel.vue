<script setup>
import { h, isVNode } from 'vue';
import { Settings, Camera, FileDownload, TrashX, SquareCheck, ExternalLink, ZoomIn } from '@vicons/tabler';
import {
  NbArchiveInfoCard,
  NbCommandDmTimeline,
  NbDanmakuTable,
  NbImage,
  mountVueucStyles,
} from 'nb-ui';
import { useDialog, useMessage, useModal, useNotification, useThemeVars } from 'naive-ui';
import DmDataLoaderPanel from '../components/DmDataLoaderPanel';
import DmChartManager from '../components/DmChartManager';
import InteractiveGraphPanel from '../components/InteractiveGraphPanel';
import PanelSettings from '../components/PanelSettings';
import ShareQrLinks from '../components/ShareQrLinks';
import UserPanel from './UserPanel.vue';
import mountStyle from './DmPanel.style.cssr.js';
import { segmentWords } from '../workers/segmentWordsWorker';
import { downloadHtmlText, injectPanelData } from '../utils/panelExport';
import storage from '../utils/storage';
import * as utils from '../utils/utils';
import { runtimeCdnUrls } from '../config/cdn';

const ECHARTS_URL = runtimeCdnUrls.echarts;
const WORDCLOUD_URL = runtimeCdnUrls.echartsWordcloud;
const HTML2CANVAS_URL = runtimeCdnUrls.html2canvas;
const DEFAULT_EXTERNAL_PANEL_URL = 'https://zbpine.github.io/bili-data-statistic/';
const EXTERNAL_PANEL_SELECTED_KEY = 'external.panelUrl.selected';
const EXTERNAL_PANEL_LEGACY_KEY = 'external.panelUrl';
const EXTERNAL_PANEL_WINDOW_NAME = 'bds-readonly-panel';
const PANEL_TRANSFER_TYPE = 'BDS_PANEL_TRANSFER';
const PANEL_TRANSFER_ACK_TYPE = 'BDS_PANEL_TRANSFER_ACK';

let echartsLoadTask = null;
let html2canvasLoadTask = null;
const pageScriptTasks = new Map();

const findScriptBySrcPart = (srcPart) => {
  return Array.from(document.scripts || []).find((script) => String(script?.src || '').includes(srcPart));
};

const appendPageScript = (url) => {
  if (pageScriptTasks.has(url)) {
    return pageScriptTasks.get(url);
  }

  const existing = findScriptBySrcPart(url);
  if (existing) {
    return Promise.resolve();
  }

  const task = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.bdsEcharts = 'true';
    script.onload = () => {
      script.dataset.bdsLoaded = 'true';
      resolve();
    };
    script.onerror = () => {
      pageScriptTasks.delete(url);
      reject(new Error(`load script failed: ${url}`));
    };
    (document.head || document.documentElement).appendChild(script);
  });

  pageScriptTasks.set(url, task);
  return task;
};

const ensurePageEcharts = async () => {
  if (!echartsLoadTask) {
    echartsLoadTask = (async () => {
      if (!runtimeWindow?.echarts?.init) {
        await appendPageScript(ECHARTS_URL);
      }
      await appendPageScript(WORDCLOUD_URL);
      if (!runtimeWindow?.echarts?.init) {
        throw new Error('echarts 未加载到 window');
      }
    })();
  }
  await echartsLoadTask;
};

const ensurePageHtml2canvas = async () => {
  if (!html2canvasLoadTask) {
    html2canvasLoadTask = (async () => {
      if (!runtimeWindow?.html2canvas) {
        await appendPageScript(HTML2CANVAS_URL);
      }
      if (!runtimeWindow?.html2canvas) {
        throw new Error('html2canvas 未加载到 window');
      }
      return runtimeWindow.html2canvas;
    })();
  }
  return await html2canvasLoadTask;
};

const normalizeExternalPanelUrl = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
};

const getSelectedExternalPanelUrl = () => {
  const selected = normalizeExternalPanelUrl(storage.get(EXTERNAL_PANEL_SELECTED_KEY, ''));
  if (selected) return selected;
  const legacy = normalizeExternalPanelUrl(storage.get(EXTERNAL_PANEL_LEGACY_KEY, ''));
  if (legacy) return legacy;
  return DEFAULT_EXTERNAL_PANEL_URL;
};

const props = defineProps({
  url: {
    type: String,
    default: '',
  },
  to: {
    type: [String, Object],
    default: undefined,
  },
  active: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'script',
  },
});
const emit = defineEmits(['update:url']);

const styleMountTarget = inject('styleMountTarget', null);
const BDM = inject('BDM', null);
const data = inject('data', shallowRef(null));
const runtimeWindow = inject('runtimeWindow', window);
const getStaticHtmlText = inject('getStaticHtmlText', null);
const themeSettings = inject('themeSettings', null);
mountStyle(styleMountTarget);

const arcMgr = shallowRef(null);
const dmMgr = shallowRef(null);

const panelError = ref('');

const archiveInfo = shallowRef({});
const commandDms = shallowRef([]);
const dmBase = shallowRef([]);
const committedDmView = shallowRef([]);
const stagedDmView = shallowRef([]);
const danmakuTableRef = ref(null);
const chartManagerRef = ref(null);
const dividerRef = ref(null);

const committedFilters = ref([]);
const stagedFilter = ref(null);
const regexText = ref('^(哈|呵|h|ha|H|HA|233+)+$');
const chartMenus = ref([]);
const panelSettingsVisible = ref(false);
const midHashDialogVisible = ref(false);
const userPanelModalVisible = ref(false);
const pendingMidHash = ref('');
const expandedNames = ref(props.mode === 'readonly' ? ['list'] : ['load', 'list']);
const userTouchedCollapse = ref(false);
const leftContentRef = ref(null);
const sharingImage = ref(false);
const exportingPanel = ref(false);
const sharePreviewVisible = ref(false);
const shareImageUrl = ref('');
const openingExternalPanel = ref(false);
const interactiveGraphLoading = ref(false);
const interactVideoModalVisible = ref(false);
const interactiveGraphPanelRef = ref(null);
const dmDataLoaderPanelRef = ref(null);
const qrLinkItems = [
  {
    url: 'https://greasyfork.org/zh-CN/scripts/534432',
    title: 'GreasyFork',
    icon: 'https://greasyfork.org/vite/assets/blacklogo96-CxYTSM_T.png',
  },
  {
    url: 'https://scriptcat.org/zh-CN/script-show-page/3750',
    title: 'ScriptCat',
    icon: 'https://scriptcat.org/favicon.ico',
  },
];

let filterIdSeed = 1;

const hasInitialized = ref(false);
const currentArchiveId = ref('');
const isReadonlyMode = computed(() => props.mode === 'readonly');
const echartsReady = ref(Boolean(runtimeWindow?.echarts?.init));
const message = useMessage();
const dialog = useDialog();
const notification = useNotification();
const modal = useModal();
const themeVars = useThemeVars();

const panelCssVars = computed(() => {
  return {
    '--dm-border-color': themeVars.value.borderColor,
  };
});

const baseColor = computed(() => themeVars.value.baseColor || themeVars.value.cardColor || '#fff');

const chartCtx = computed(() => ({
  BDM,
  arcMgr: arcMgr.value,
  dmMgr: dmMgr.value,
  tableRef: danmakuTableRef,
  tableItems: stagedDmView.value,
  stagedFilter: stagedFilter.value,
  committedFilters: committedFilters.value,
  segmentWords,
  utils,
  feedback: {
    message,
    dialog,
    notification,
    modal,
  },
  queryMidHash: openMidHashQuery,
}));

const isListExpanded = computed(() => expandedNames.value.includes('list'));

const isInteractiveVideo = computed(() => {
  return Boolean(arcMgr.value?.data?.player_info?.interaction?.graph_version);
});

const viewPoints = computed(() => {
  const list = arcMgr.value?.data?.player_info?.view_points;
  return Array.isArray(list) ? list : [];
});

const formatViewPointRange = (item) => {
  return `${utils.formatProgress(Number(item?.from || 0) * 1000)} - ${utils.formatProgress(Number(item?.to || 0) * 1000)}`;
};

const viewPointItemKey = (item, index) => {
  const from = Number.isFinite(Number(item?.from)) ? Number(item.from) : index;
  const to = Number.isFinite(Number(item?.to)) ? Number(item.to) : index;
  const content = String(item?.content || '').trim();
  return `${from}-${to}-${content || index}`;
};

const getInteractiveGraph = async (dedupe) => {
  if (!arcMgr.value?.invoke) return {};
  const graphMap = await arcMgr.value.invoke('buildInteractGraph', Boolean(dedupe)) || {};
  const varsMap = await arcMgr.value.invoke('getInteractVarsMap') || {};
  return { graphMap, varsMap };
};

const getInteractiveEcharts = async () => {
  await ensurePageEcharts();
  return runtimeWindow?.echarts || null;
};

const switchByInteractiveNode = async (value) => {
  if (!value?.cid || !arcMgr.value?.invoke || !dmMgr.value) return false;

  const nextInfo = await arcMgr.value.invoke('buildInfoByGraphNode', value);
  if (!nextInfo || typeof nextInfo !== 'object') return false;
  archiveInfo.value = nextInfo;

  const hasDmList = Boolean(dmMgr.value.changeInfo?.(archiveInfo.value));
  syncDanmakuState({
    list: dmMgr.value?.data?.danmaku_list || [],
    commandDms: dmMgr.value?.data?.danmaku_view?.commandDms || [],
  });

  if (!hasDmList) {
    await dmDataLoaderPanelRef.value?.runAutoLoad?.();
  }
  return true;
};

const onInteractiveGraphClick = async (value) => {
  if (interactiveGraphLoading.value) return;
  const nextCid = value?.cid;
  if (nextCid != null && String(nextCid) === String(archiveInfo.value?.cid ?? '')) return;
  try {
    interactiveGraphLoading.value = true;
    await switchByInteractiveNode(value);
  } catch (error) {
    BDM?.logger?.error?.('[interactive graph] 切换节点失败', error);
    message.error(String(error?.message || error || '互动节点切换失败'));
  } finally {
    interactiveGraphLoading.value = false;
  }
};

const loadAllInteractiveDanmaku = async () => {
  if (!arcMgr.value?.invoke || !dmMgr.value || interactiveGraphLoading.value) return;
  try {
    interactiveGraphLoading.value = true;
    const graph = await arcMgr.value.invoke('buildInteractGraph', true) || {};
    const currentCid = String(archiveInfo.value?.cid ?? '');
    const seen = new Set();
    for (const item of Object.values(graph)) {
      const cid = item?.cid;
      if (cid == null) continue;
      const key = String(cid);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (key === currentCid) continue;
      await switchByInteractiveNode(item);
      await nextTick();
    }
    interactiveGraphLoading.value = false;
  } catch (error) {
    BDM?.logger?.error?.('[interactive graph] 载入全部弹幕失败', error);
    message.error(String(error?.message || error || '载入所有弹幕失败'));
    interactiveGraphLoading.value = false;
  }
};

const refreshInteractiveGraphData = async () => {
  await interactiveGraphPanelRef.value?.refresh?.();
};

const disposeInteractiveGraph = () => {
  interactiveGraphPanelRef.value?.dispose?.();
};

const loadInteractiveGraph = async () => {
  if (!arcMgr.value || interactiveGraphLoading.value) return;
  interactiveGraphLoading.value = true;
  try {
    await arcMgr.value.invoke('getInteractEdgeInfo', async () => {
      await refreshInteractiveGraphData();
    });
    await refreshInteractiveGraphData();
  } catch (error) {
    BDM?.logger?.error?.('[interactive graph] 加载失败', error);
    message.error(String(error?.message || error || '互动图谱加载失败'));
  } finally {
    interactiveGraphLoading.value = false;
  }
};

const clearInteractiveGraph = async () => {
  if (!arcMgr.value || interactiveGraphLoading.value) return;
  interactiveGraphLoading.value = true;
  try {
    await arcMgr.value.invoke('clearInteractEdgeInfo');
    await refreshInteractiveGraphData();
  } catch (error) {
    BDM?.logger?.error?.('[interactive graph] 清除失败', error);
    message.error(String(error?.message || error || '清除互动图谱失败'));
  } finally {
    interactiveGraphLoading.value = false;
  }
};

const chartSettings = computed(() => chartManagerRef.value?.settings || null);

const setPanelError = (error) => {
  panelError.value = error ? String(error?.message || error) : '';
};

const clearStage = () => {
  stagedFilter.value = null;
};

const formatFilterValueNode = (filter, value) => {
  const shouldWrapTag = filter?.wrapTag !== false;
  const rendered = typeof filter.formatValue === 'function' ? filter.formatValue(value) : String(value);
  const fallback = rendered == null || rendered === '' ? String(value) : rendered;
  if (!shouldWrapTag) return fallback;
  if (isVNode(fallback)) return fallback;
  return h(NTag, { size: 'small' }, { default: () => String(fallback) });
};

const FilterLabel = defineComponent({
  name: 'FilterLabel',
  props: {
    filter: {
      type: Object,
      required: true,
    },
  },
  setup(componentProps) {
    return () => {
      const filter = componentProps.filter;
      const values = Array.isArray(filter.values) ? filter.values : [];
      const renderedValues = values.flatMap((value, index) => {
        const node = formatFilterValueNode(filter, value);
        if (index === 0) return [node];
        return [', ', node];
      });
      const template = String(filter.template || '{value}');
      if (template.includes('{value}')) {
        const [before, after = ''] = template.split('{value}');
        return h('span', [before, ...renderedValues, after]);
      }
      return h('span', [template, ' ', ...renderedValues]);
    };
  },
});

const applySingleFilter = (items, filter) => {
  const values = Array.isArray(filter.values) ? filter.values : [];
  if (!values.length || typeof filter.predicate !== 'function') return items;
  return items.filter((item) => {
    const matched = values.some((value) => filter.predicate(item, value));
    return filter.exclude ? !matched : matched;
  });
};

const buildStagedView = (baseItems) => {
  let next = [...baseItems];
  if (stagedFilter.value) {
    next = applySingleFilter(next, { ...stagedFilter.value, exclude: false });
  }
  return next;
};

const rebuildFilterViews = () => {
  let next = [...dmBase.value];

  const activeCommitted = committedFilters.value.filter((filter) => filter.enabled);
  for (const filter of activeCommitted) {
    next = applySingleFilter(next, filter);
  }

  committedDmView.value = next;
  stagedDmView.value = buildStagedView(next);
};

const clearAllFilters = () => {
  committedFilters.value = [];
  clearStage();
  committedDmView.value = [...dmBase.value];
  stagedDmView.value = [...dmBase.value];
};

const applyRegexFilter = () => {
  try {
    const regex = new RegExp(regexText.value, 'i');
    const oldIdx = committedFilters.value.findIndex((item) => item.source === 'regex');
    const nextExclude = oldIdx >= 0 ? Boolean(committedFilters.value[oldIdx]?.exclude) : false;
    const regexFilter = {
      id: `f-${filterIdSeed++}`,
      source: 'regex',
      template: '正则筛选 {value}',
      values: [regexText.value],
      formatValue: (value) => `/${value}/i`,
      predicate: (item) => regex.test(String(item?.content || '')),
      wrapTag: true,
      enabled: true,
      exclude: nextExclude,
    };
    if (oldIdx >= 0) committedFilters.value.splice(oldIdx, 1, regexFilter);
    else committedFilters.value.push(regexFilter);
    clearStage();
    rebuildFilterViews();
  } catch (error) {
    BDM?.logger?.warn?.('[regex filter] 无效表达式', error);
    message.error('无效正则表达式');
  }
};

const stageFilter = (payload) => {
  if (!payload || typeof payload.predicate !== 'function') return;
  const source = String(payload.source || 'chart:unknown');
  const value = payload.value;
  if (value == null || value === '') return;

  if (!stagedFilter.value || stagedFilter.value.source !== source) {
    stagedFilter.value = {
      source,
      template: payload.template || '{value}',
      values: [value],
      formatValue: payload.formatValue || ((v) => String(v)),
      predicate: payload.predicate,
      wrapTag: payload.wrapTag !== false,
    };
    stagedDmView.value = buildStagedView(committedDmView.value);
    return;
  }

  const draft = stagedFilter.value;
  draft.template = payload.template || draft.template;
  draft.formatValue = payload.formatValue || draft.formatValue;
  draft.predicate = payload.predicate;
  draft.wrapTag = payload.wrapTag !== false;

  const index = draft.values.findIndex((item) => item === value);
  if (index >= 0) draft.values.splice(index, 1);
  else draft.values.push(value);

  if (!draft.values.length) stagedFilter.value = null;
  stagedDmView.value = buildStagedView(committedDmView.value);
};

const commitStagedFilter = () => {
  const draft = stagedFilter.value;
  if (!draft || !draft.values.length) return;
  committedFilters.value.push({
    id: `f-${filterIdSeed++}`,
    source: draft.source,
    template: draft.template,
    values: [...draft.values],
    formatValue: draft.formatValue,
    predicate: draft.predicate,
    wrapTag: draft.wrapTag !== false,
    enabled: true,
    exclude: false,
  });
  stagedFilter.value = null;
  rebuildFilterViews();
};

const unstageFilter = () => {
  stagedFilter.value = null;
  stagedDmView.value = buildStagedView(committedDmView.value);
};

const toggleCommittedEnabled = (id) => {
  const target = committedFilters.value.find((item) => item.id === id);
  if (!target) return;
  target.enabled = !target.enabled;
  rebuildFilterViews();
};

const toggleCommittedExclude = (id) => {
  const target = committedFilters.value.find((item) => item.id === id);
  if (!target) return;
  target.exclude = !target.exclude;
  rebuildFilterViews();
};

const removeCommittedFilter = (id) => {
  const idx = committedFilters.value.findIndex((item) => item.id === id);
  if (idx < 0) return;
  committedFilters.value.splice(idx, 1);
  rebuildFilterViews();
};

const hasStagedFilter = computed(() => {
  return Boolean(stagedFilter.value && Array.isArray(stagedFilter.value.values) && stagedFilter.value.values.length > 0);
});

const hasAnyFilter = computed(() => {
  return committedFilters.value.length > 0 || hasStagedFilter.value;
});

const syncDanmakuState = ({ list = [], commandDms: cmd = [] } = {}) => {
  dmBase.value = Array.isArray(list) ? [...list] : [];
  commandDms.value = Array.isArray(cmd) ? cmd : [];
  clearAllFilters();
};

let ensureManagerRunning = false;
let ensureManagerPending = false;
let ensureManagerPromise = null;

const queueEnsureManager = async () => {
  if (ensureManagerRunning) {
    ensureManagerPending = true;
    return ensureManagerPromise;
  }

  ensureManagerRunning = true;
  ensureManagerPromise = (async () => {
    let lastError = null;
    do {
      ensureManagerPending = false;
      try {
        await ensureManager();
        lastError = null;
      } catch (error) {
        lastError = error;
      }
    } while (ensureManagerPending);

    if (lastError) {
      throw lastError;
    }
  })().finally(() => {
    ensureManagerRunning = false;
    ensureManagerPromise = null;
  });

  return ensureManagerPromise;
};

const ensureManager = async () => {
  if (!BDM?.BiliArchive || !BDM?.BiliDanmaku) throw new Error('BDM 不可用');
  let sourceUrl = String(props.url || '').trim();

  const payload = data?.value;
  data.value = null;
  if (payload && typeof payload === 'object') {
    const nextArcMgr = new BDM.BiliArchive();
    const info = nextArcMgr.setData(payload);
    const nextInfo = info || nextArcMgr.info || {};
    const nextDmMgr = new BDM.BiliDanmaku(nextInfo);
    nextDmMgr.setData(payload);
    const nextId = String(nextInfo?.id || `upload-${Date.now()}`).trim();

    arcMgr.value = nextArcMgr;
    archiveInfo.value = nextInfo;
    dmMgr.value = nextDmMgr;
    sourceUrl = String(nextInfo?.url || '').trim();
    emit('update:url', sourceUrl);

    if (currentArchiveId.value !== nextId) {
      expandedNames.value = isReadonlyMode.value ? ['list'] : ['load', 'list'];
      userTouchedCollapse.value = false;
    }
    currentArchiveId.value = nextId;
  }
  syncDanmakuState({
    list: dmMgr.value?.data?.danmaku_list || [],
    commandDms: dmMgr.value?.data?.danmaku_view?.commandDms || [],
  });
  if (isReadonlyMode.value) return;

  if (!sourceUrl) {
    if (payload && typeof payload === 'object') return;
    throw new Error('未提供稿件 URL');
  }
  const parsed = typeof BDM.BiliArchive.parseUrl === 'function'
    ? BDM.BiliArchive.parseUrl(sourceUrl)
    : {};
  const parsedId = String(parsed?.id || '').trim();
  if (!parsedId) throw new Error('无法从URL中解析稿件 ID');

  if (arcMgr.value && dmMgr.value && currentArchiveId.value === parsedId) {
    return;
  }

  const nextArcMgr = new BDM.BiliArchive();
  const info = await nextArcMgr.getData(sourceUrl);
  await nextArcMgr.getPlayerInfo();
  const nextInfo = info || nextArcMgr.info || {};
  const nextId = String(nextInfo?.id || parsedId).trim();
  if (!nextId) throw new Error('稿件信息获取失败');

  arcMgr.value = nextArcMgr;
  archiveInfo.value = nextInfo;
  dmMgr.value = new BDM.BiliDanmaku(nextInfo);
  sourceUrl = String(nextInfo?.url || '').trim();
  emit('update:url', sourceUrl);
  if (currentArchiveId.value !== nextId) {
    expandedNames.value = isReadonlyMode.value ? ['list'] : ['load', 'list'];
    userTouchedCollapse.value = false;
  }
  currentArchiveId.value = nextId;

};

const danmakuTableMenus = computed(() => {
  const defaultMenus = [
    {
      getName: (item) => `点赞数：${Number.isInteger(item?.likes) ? item.likes : '点击获取'}`,
      onSelect: async (item) => {
        if (!dmMgr.value?.api || !archiveInfo.value?.cid || !item?.idStr) return;
        try {
          const likes = await dmMgr.value.api.getLikes(archiveInfo.value.cid, [String(item.idStr)]);
          item.likes = likes?.[String(item.idStr)]?.likes ?? 0;
        } catch (error) {
          BDM?.logger?.warn('[dm likes] 查询失败', error);
        }
      },
      disabled: isReadonlyMode.value,
    },
  ];
  return [...defaultMenus, ...chartMenus.value];
});

const updateChartMenus = (menus) => {
  chartMenus.value = Array.isArray(menus) ? menus : [];
};

const copyMidHash = async (midHash) => {
  const hash = String(midHash || '').trim();
  if (!hash) return;
  try {
    await navigator.clipboard.writeText(hash);
    message.success('midHash已复制到剪贴板');
  } catch (error) {
    BDM?.logger?.error?.('midHash复制失败', error);
    message.error('复制失败');
  }
};

const openMidHashQuery = (midHash) => {
  const hash = String(midHash || '').trim();
  if (!hash) return;
  pendingMidHash.value = hash;
  midHashDialogVisible.value = true;
};

const revokeSharePreview = () => {
  if (shareImageUrl.value && shareImageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(shareImageUrl.value);
  }
  shareImageUrl.value = '';
};

const onInteractiveGraphCapture = (dataUrl) => {
  const nextUrl = String(dataUrl || '');
  if (!nextUrl) return;
  revokeSharePreview();
  shareImageUrl.value = nextUrl;
  sharePreviewVisible.value = true;
};

const canvasToBlob = (canvas, type = 'image/png') => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片导出失败'));
    }, type);
  });
};

const shareImage = async () => {
  if (sharingImage.value) return;
  const html2canvasTask = ensurePageHtml2canvas();
  const leftEl = leftContentRef.value?.$el;
  const tableEl = danmakuTableRef.value?.$el?.parentElement;
  const dividerEl = dividerRef.value?.$el;
  const chartBodyEl = chartManagerRef.value?.chartBodyEl || null;
  const chartItemEls = Array.from(chartBodyEl?.children || []);

  try {
    sharingImage.value = true;
    await nextTick();

    const elList = [leftEl, tableEl, dividerEl, ...chartItemEls].filter((el) => {
      if (!el) return false;
      return window.getComputedStyle(el).display !== 'none';
    });
    if (!elList.length) {
      throw new Error('找不到截图区域');
    }

    const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
    const baseCaptureOptions = {
      scale: pixelRatio,
      backgroundColor: baseColor.value,
      useCORS: true,
    };
    const html2canvas = await html2canvasTask;

    const canvasList = (await Promise.all(
      elList.map((el) => html2canvas(el, baseCaptureOptions)),
    )).filter(Boolean);
    if (!canvasList.length) {
      throw new Error('截图生成失败');
    }

    // const gap = Math.round(16 * pixelRatio);
    const padding = Math.round(24 * pixelRatio);
    const contentWidth = Math.max(...canvasList.map((c) => c.width));
    const width = contentWidth + padding * 2;
    const height = padding * 2 + canvasList.reduce((sum, c) => sum + c.height, 0);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建绘图上下文');

    ctx.fillStyle = baseColor.value;
    ctx.fillRect(0, 0, width, height);
    let y = padding;
    for (const itemCanvas of canvasList) {
      const x = padding + Math.floor((contentWidth - itemCanvas.width) / 2);
      ctx.drawImage(itemCanvas, x, y);
      y += itemCanvas.height;
    }

    const finalBlob = await canvasToBlob(canvas, 'image/png');

    revokeSharePreview();
    shareImageUrl.value = URL.createObjectURL(finalBlob);
    sharePreviewVisible.value = true;
  } catch (error) {
    BDM?.logger?.error?.('分享图片生成失败', error);
    message.error('截图生成失败');
  } finally {
    sharingImage.value = false;
  }
};

const downloadShareImage = () => {
  const url = String(shareImageUrl.value || '');
  if (!url) return;
  const link = document.createElement('a');
  const id = String(archiveInfo.value?.id || 'bili-data-statistic').trim() || 'bili-data-statistic';
  link.href = url;
  link.download = `${id}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const buildExportData = () => {
  const merged = {
    ...(dmMgr.value?.data || {}),
    ...(arcMgr.value?.data || {}),
  };
  if (Object.keys(merged).length > 0) {
    return merged;
  }
  if (data?.value && typeof data.value === 'object') {
    return data.value;
  }
  return null;
};

const downloadInjectedPanel = async () => {
  if (exportingPanel.value) return;
  if (typeof getStaticHtmlText !== 'function') {
    message.error('静态模板读取能力不可用');
    return;
  }

  const exportData = buildExportData();
  if (!exportData) {
    message.warning('当前没有可导出的弹幕数据');
    return;
  }

  try {
    exportingPanel.value = true;
    const templateHtml = await getStaticHtmlText();
    const injectedHtml = injectPanelData(templateHtml, exportData);
    const id = String(archiveInfo.value?.id || 'bili-data-statistics').trim() || 'bili-data-statistics';
    downloadHtmlText(injectedHtml, `${id}.html`);
    message.success('静态面板已下载');
  } catch (error) {
    BDM?.logger?.error?.('静态面板下载失败', error);
    message.error('静态面板下载失败');
  } finally {
    exportingPanel.value = false;
  }
};

const openExternalPanel = async () => {
  if (openingExternalPanel.value) return;

  const targetUrl = getSelectedExternalPanelUrl();
  const targetOrigin = new URL(targetUrl).origin;

  const exportData = buildExportData();
  if (!exportData) {
    message.warning('当前没有可发送的弹幕数据');
    return;
  }

  const targetWindow = window.open(targetUrl, EXTERNAL_PANEL_WINDOW_NAME);
  if (!targetWindow) {
    message.error('打开外部页面失败，请检查浏览器拦截设置');
    return;
  }

  openingExternalPanel.value = true;
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const transferPayload = {
    type: PANEL_TRANSFER_TYPE,
    sessionId,
    version: 1,
    payload: exportData,
  };

  let retryTimer = null;
  let timeoutTimer = null;

  const cleanup = () => {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    window.removeEventListener('message', onMessage);
    openingExternalPanel.value = false;
  };

  const sendPayload = () => {
    try {
      targetWindow.postMessage(transferPayload, targetOrigin);
    } catch {
      // ignore and wait next retry
    }
  };

  const onMessage = (event) => {
    if (event.origin !== targetOrigin) return;
    if (event.source !== targetWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== PANEL_TRANSFER_ACK_TYPE) return;
    if (data.sessionId !== sessionId) return;
    cleanup();
    message.success('已新标签页打开并发送数据');
  };

  window.addEventListener('message', onMessage);
  sendPayload();
  retryTimer = setInterval(sendPayload, 400);
  timeoutTimer = setTimeout(() => {
    cleanup();
    message.warning('外部页面未响应，可在外部页面加载完成后重试');
  }, 10000);
};

const confirmMidHashQuery = () => {
  midHashDialogVisible.value = false;
  userPanelModalVisible.value = true;
};

const onCollapseUpdate = (names) => {
  userTouchedCollapse.value = true;
  expandedNames.value = Array.isArray(names) ? names : [];
};

const handleInitialLoadFinished = () => {
  if (userTouchedCollapse.value) return;
  if (isReadonlyMode.value) return;
  expandedNames.value = expandedNames.value.filter((name) => name !== 'load');
};

watch(
  () => props.active,
  async (active) => {
    if (!active) return;
    if (!hasInitialized.value) {
      mountVueucStyles(styleMountTarget || undefined);
      hasInitialized.value = true;
    }
    try {
      setPanelError('');
      await queueEnsureManager();
      if (!echartsReady.value) {
        await ensurePageEcharts();
        echartsReady.value = true;
      }
      await nextTick();
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      chartManagerRef.value?.chartResize?.();
      interactiveGraphPanelRef.value?.resize?.();
    } catch (error) {
      setPanelError(error);
    }
  },
  { immediate: true },
);

watch(
  () => data?.value,
  async (payload, previous) => {
    if (!props.active) return;
    if (!payload || typeof payload !== 'object') return;
    if (payload === previous) return;
    try {
      setPanelError('');
      await queueEnsureManager();
    } catch (error) {
      setPanelError(error);
    }
  },
);

watch(
  [isInteractiveVideo, () => props.active, currentArchiveId, () => interactiveGraphPanelRef.value],
  async ([nextIsInteractive, active, _archiveId, panelRef]) => {
    if (!active || !nextIsInteractive) {
      disposeInteractiveGraph();
      return;
    }
    if (!panelRef) return;
    await refreshInteractiveGraphData();
  },
  { flush: 'post' },
);

watch(hasAnyFilter, (next, prev) => {
  if (!next || prev) return;
  if (expandedNames.value.includes('result')) return;
  expandedNames.value = [...expandedNames.value, 'result'];
});

onBeforeUnmount(() => {
  revokeSharePreview();
  disposeInteractiveGraph();
});

</script>

<template>
  <div class="bds-dm-panel" :style="panelCssVars">
    <div class="bds-dm-panel__main">
      <div class="bds-dm-panel__left">
        <n-flex :size="12" vertical ref="leftContentRef">
          <n-alert v-if="panelError" type="error" :title="panelError" />

          <nb-archive-info-card :archive-info="archiveInfo" />

          <n-divider style="margin: 4px 0;" />

          <n-collapse v-if="arcMgr && dmMgr" display-directive="show" :expanded-names="expandedNames"
            @update:expanded-names="onCollapseUpdate">
            <n-collapse-item v-if="viewPoints.length" name="viewPoint" title="章节">
              <n-timeline>
                <n-timeline-item v-for="(item, index) in viewPoints" :key="viewPointItemKey(item, index)"
                  :color="themeVars.primaryColor">
                  <n-flex class="bds-dm-panel__viewpoint-row" :size="12" align="start">
                    <nb-image v-if="item?.imgUrl" class="bds-dm-panel__viewpoint-image" :src="item.imgUrl" width="100%"
                      object-fit="contain" />
                    <n-flex class="bds-dm-panel__viewpoint-meta" vertical :size="6">
                      <n-text strong>{{ String(item?.content || '').trim() || '未命名章节' }}</n-text>
                      <n-text depth="3">{{ formatViewPointRange(item) }}</n-text>
                    </n-flex>
                  </n-flex>
                </n-timeline-item>
              </n-timeline>
            </n-collapse-item>

            <n-collapse-item v-if="isInteractiveVideo" name="interactive" title="互动视频">
              <n-flex vertical :size="8">
                <n-flex :size="8" wrap>
                  <n-button v-if="!isReadonlyMode" size="small" type="primary" :loading="interactiveGraphLoading"
                    :disabled="interactiveGraphLoading" @click="loadInteractiveGraph">
                    加载互动图谱
                  </n-button>
                  <n-button size="small" type="error" :disabled="interactiveGraphLoading"
                    @click="clearInteractiveGraph">
                    清除互动图谱
                  </n-button>
                  <n-button v-if="!isReadonlyMode" size="small" type="warning" :loading="interactiveGraphLoading"
                    :disabled="interactiveGraphLoading" @click="loadAllInteractiveDanmaku">
                    载入所有弹幕
                  </n-button>
                  <n-button size="small" circle title="放大查看" style="margin-left: auto;"
                    @click="interactVideoModalVisible = true">
                    <template #icon>
                      <n-icon>
                        <zoom-in />
                      </n-icon>
                    </template>
                  </n-button>
                </n-flex>
                <interactive-graph-panel ref="interactiveGraphPanelRef" :graph-loading="interactiveGraphLoading"
                  :get-graph="getInteractiveGraph" :get-echarts="getInteractiveEcharts"
                  @graph-click="onInteractiveGraphClick" @graph-capture="onInteractiveGraphCapture" />
              </n-flex>
            </n-collapse-item>

            <n-collapse-item name="load" :title="`载入弹幕 ${dmBase.length.toLocaleString()} 条`">
              <dm-data-loader-panel v-if="!isReadonlyMode" ref="dmDataLoaderPanelRef"
                :key="archiveInfo.id || currentArchiveId" :arc-mgr="arcMgr" :dm-mgr="dmMgr" :to="props.to"
                @sync-data="syncDanmakuState" @set-error="setPanelError"
                @initial-load-finished="handleInitialLoadFinished" />
            </n-collapse-item>

            <n-collapse-item v-if="commandDms.length" name="command"
              :title="`互动弹幕 ${commandDms.length.toLocaleString()} 条`">
              <nb-command-dm-timeline :command-dms="commandDms" />
            </n-collapse-item>

            <n-collapse-item name="result" :title="`筛选弹幕 ${committedDmView.length.toLocaleString()} 条`">
              <n-flex vertical :size="8" class="bds-dm-panel__result-block">
                <n-flex v-if="committedFilters.length" vertical :size="8">
                  <n-flex v-for="item in committedFilters" :key="item.id" align="center" :size="[12, 4]" wrap>
                    <n-checkbox :checked="item.enabled" @update:checked="() => toggleCommittedEnabled(item.id)" />
                    <filter-label :filter="item" />
                    <n-checkbox :checked="item.exclude" style="margin-left: auto;"
                      @update:checked="() => toggleCommittedExclude(item.id)">
                      排除
                    </n-checkbox>
                    <n-button size="tiny" tertiary type="error" title="清除筛选" @click="removeCommittedFilter(item.id)">
                      <n-icon>
                        <trash-x />
                      </n-icon>
                    </n-button>
                  </n-flex>
                </n-flex>

                <n-flex v-if="hasStagedFilter" vertical :size="6">
                  <n-flex align="center" :size="[12, 4]" wrap>
                    <filter-label :filter="stagedFilter" />
                    <n-text depth="3">弹幕共 {{ stagedDmView.length.toLocaleString() }} 条</n-text>
                    <n-button size="tiny" tertiary type="error" title="清除子筛选" @click="unstageFilter"
                      style="margin-left: auto;">
                      <n-icon>
                        <trash-x />
                      </n-icon>
                    </n-button>
                    <n-button size="tiny" tertiary type="success" title="提交子筛选结果作为新的数据源" @click="commitStagedFilter">
                      <n-icon>
                        <square-check />
                      </n-icon>
                    </n-button>
                  </n-flex>
                </n-flex>
              </n-flex>
            </n-collapse-item>

            <n-collapse-item name="list" :title="`列表弹幕 ${stagedDmView.length.toLocaleString()} 条`">
            </n-collapse-item>
          </n-collapse>
        </n-flex>
        <div v-show="isListExpanded" class="bds-dm-panel__table-block">
          <nb-danmaku-table class="bds-dm-panel__table" :items="stagedDmView" :item-height="40"
            :menu-items="danmakuTableMenus" :to="props.to" ref="danmakuTableRef" />
        </div>
        <n-divider style="padding: 16px 0;" ref="dividerRef" v-show="sharingImage" />
      </div>

      <div class="bds-dm-panel__right">
        <n-flex align="center" :size="8" wrap class="bds-dm-panel__right-header">
          <n-input v-model:value="regexText" placeholder="请输入正则表达式" size="small" style="flex: 1; min-width: 200px;" />
          <n-button size="small" :type="committedFilters.length ? undefined : 'warning'"
            @click="applyRegexFilter">筛选</n-button>
          <n-button size="small" :type="committedFilters.length ? 'warning' : undefined"
            @click="clearAllFilters">取消筛选</n-button>
          <n-button v-if="props.mode !== 'script'" size="small" circle title="转为图片" :loading="sharingImage"
            @click="shareImage">
            <template #icon>
              <n-icon>
                <camera />
              </n-icon>
            </template>
          </n-button>
          <n-button v-else size="small" circle title="新标签页打开" :loading="openingExternalPanel"
            @click="openExternalPanel">
            <template #icon>
              <n-icon>
                <external-link />
              </n-icon>
            </template>
          </n-button>
          <n-button size="small" circle title="下载面板" :loading="exportingPanel" @click="downloadInjectedPanel">
            <template #icon>
              <n-icon>
                <file-download />
              </n-icon>
            </template>
          </n-button>
          <n-popover trigger="hover" placement="bottom-end" :to="props.to">
            <template #trigger>
              <n-button size="small" circle title="设置" @click="panelSettingsVisible = true">
                <template #icon>
                  <n-icon>
                    <settings />
                  </n-icon>
                </template>
              </n-button>
            </template>
            <ShareQrLinks :links="qrLinkItems" />
          </n-popover>
        </n-flex>
        <n-alert v-if="!echartsReady" type="info" title="图表库加载中..." />
        <dm-chart-manager ref="chartManagerRef" v-else :items="committedDmView" :chart-ctx="chartCtx" :to="props.to"
          @select-filter="stageFilter" @update:chart-menus="updateChartMenus" />
      </div>
    </div>

    <n-modal v-model:show="panelSettingsVisible" preset="card" title="设置"
      style="width: max(600px, 50vw); max-height: 60vh;" :to="props.to">
      <panel-settings :chart-settings="chartSettings" :theme-settings="themeSettings" :mode="props.mode" />
    </n-modal>

    <n-modal v-model:show="midHashDialogVisible" preset="card" title="提示" style="width: 450px;" :to="props.to">
      <n-flex vertical :size="10">
        <n-text>是否尝试反查用户ID？</n-text>
        <n-tag size="small" type="info" style="cursor: pointer; align-self: flex-start;" title="点击复制 midHash"
          @click="copyMidHash(pendingMidHash)">
          {{ pendingMidHash }}
        </n-tag>
        <n-text depth="3">可能需要一段时间，且10位数以上ID容易查错</n-text>
        <n-flex justify="end" :size="8">
          <n-button size="small" @click="midHashDialogVisible = false">否</n-button>
          <n-button size="small" type="warning" @click="confirmMidHashQuery">是</n-button>
        </n-flex>
      </n-flex>
    </n-modal>

    <n-modal v-if="userPanelModalVisible" :show="true" preset="card" title="用户信息" style="width: 60vw;" :to="props.to"
      @update:show="(show) => { if (!show) userPanelModalVisible = false; }">
      <user-panel :url="props.url" :mid-hash="pendingMidHash" :mode="props.mode" />
    </n-modal>

    <n-modal v-model:show="sharePreviewVisible" preset="card" title="截图预览" style="width: 50vw;" :to="props.to"
      @update:show="(show) => { if (!show) revokeSharePreview(); }">
      <n-flex vertical :size="12">
        <nb-image v-if="shareImageUrl" :src="shareImageUrl" alt="截图预览" width="100%" object-fit="contain"
          style="max-height: 60vh;" />
        <n-flex justify="end" :size="8">
          <n-button @click="sharePreviewVisible = false">关闭</n-button>
          <n-button type="warning" @click="downloadShareImage">保存图片</n-button>
        </n-flex>
      </n-flex>
    </n-modal>

    <n-modal v-model:show="interactVideoModalVisible" preset="card" title="互动视频图谱" style="width: 75vw;" :to="props.to">
      <interactive-graph-panel :get-graph="getInteractiveGraph" :get-echarts="getInteractiveEcharts" :aspect-ratio="2"
        @graph-capture="onInteractiveGraphCapture" />
    </n-modal>
  </div>
</template>
