<script setup>
import mountStyle from './style.cssr.js';
import storage from '../../utils/storage';
import { useMessage } from 'naive-ui';
import { InfoCircle } from '@vicons/tabler';

const props = defineProps({
  arcMgr: {
    type: Object,
    default: null,
  },
  dmMgr: {
    type: Object,
    default: null,
  },
  to: {
    type: [String, Object],
    default: undefined,
  },
});

const emit = defineEmits([
  'sync-data',
  'set-error',
  'initial-load-finished',
  'update:loading',
]);

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const panelLoading = ref(false);
const showLoadWarning = ref(true);
const initialTodayStr = toDateStr(new Date());
const selectedDateRange = ref([initialTodayStr, initialTodayStr]);
const autoLoadXml = ref(storage.get('dmLoader.autoLoadXml', false));
const autoLoadPb = ref(storage.get('dmLoader.autoLoadPb', true));
let autoLoadMgr = null;
const message = useMessage();

const downloadMenuOptions = [
  {
    label: 'JSON',
    key: 'json',
    children: [
      { label: '无缩进', key: 'json:none' },
      { label: '缩进 2', key: 'json:2' },
      { label: '缩进 4', key: 'json:4' },
    ],
  },
];

const loadProgress = reactive({
  visible: false,
  current: 0,
  total: 0,
  text: '',
  detail: '',
  addedDm: 0,
  scannedDays: 0,
  startTs: 0,
});

const normalizeTimestampMs = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000;
};

const toDayStartMs = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const pubDayStartMs = computed(() => {
  const ts = normalizeTimestampMs(props.arcMgr?.info?.pubtime);
  return ts ? toDayStartMs(ts) : null;
});

const todayStartMs = () => toDayStartMs(Date.now());

const retryErrorSegments = ref(0);
const retryErrorDates = ref(0);
const retryErrorTotal = computed(() => retryErrorSegments.value + retryErrorDates.value);

const syncRetryErrorStats = () => {
  retryErrorSegments.value = Number(props.dmMgr?.errors?.segments?.length) || 0;
  retryErrorDates.value = Number(props.dmMgr?.errors?.dates?.length) || 0;
};

const isSameRange = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return a[0] === b[0] && a[1] === b[1];
};

const isHistoryDateDisabled = (ts) => {
  const day = toDayStartMs(ts);
  if (day > todayStartMs()) return true;
  if (pubDayStartMs.value != null && day < pubDayStartMs.value) return true;
  return false;
};

const syncDateRangeByLimits = (range = selectedDateRange.value) => {
  const todayStr = toDateStr(new Date());
  const pubStr = pubDayStartMs.value != null ? toDateStr(new Date(pubDayStartMs.value)) : '';

  let [start, end] = range || [];
  if (!start) start = pubStr || todayStr;
  if (!end) end = todayStr;

  if (pubStr && start < pubStr) start = pubStr;
  if (pubStr && end < pubStr) end = pubStr;
  if (start > todayStr) start = todayStr;
  if (end > todayStr) end = todayStr;
  if (start > end) start = end;

  const normalized = [start, end];
  if (!isSameRange(selectedDateRange.value, normalized)) {
    selectedDateRange.value = normalized;
  }
};

const resetDateRangeToDefault = () => {
  const todayStr = toDateStr(new Date());
  const pubStr = pubDayStartMs.value != null ? toDateStr(new Date(pubDayStartMs.value)) : '';
  selectedDateRange.value = [pubStr || todayStr, todayStr];
};

const onDateRangeUpdate = (value) => {
  selectedDateRange.value = Array.isArray(value) ? value : ['', ''];
  syncDateRangeByLimits(selectedDateRange.value);
};

const resetProgress = () => {
  loadProgress.visible = false;
  loadProgress.current = 0;
  loadProgress.total = 0;
  loadProgress.text = '';
  loadProgress.detail = '';
  loadProgress.addedDm = 0;
  loadProgress.scannedDays = 0;
  loadProgress.startTs = 0;
};

const startProgress = () => {
  loadProgress.visible = true;
  loadProgress.current = 0;
  loadProgress.total = 0;
  loadProgress.text = '准备中...';
  loadProgress.detail = '';
  loadProgress.addedDm = 0;
  loadProgress.scannedDays = 0;
  loadProgress.startTs = Date.now();
};

const updateProgress = (finished, total, current, count) => {
  loadProgress.current = Number(finished) || 0;
  loadProgress.total = Number(total) || 0;
  const curr = String(current || '-');
  const delta = Number(count) || 0;
  const elapsedSec = Math.max(1, Math.floor((Date.now() - loadProgress.startTs) / 1000));

  if (curr.startsWith('扫描月份:')) {
    loadProgress.scannedDays += Math.max(0, delta);
    loadProgress.text = `扫描历史日期 ${loadProgress.current}/${loadProgress.total}`;
    loadProgress.detail = `${curr} | 本月发现 ${delta} 天 | 累计 ${loadProgress.scannedDays} 天`;
    return;
  }

  if (delta > 0) loadProgress.addedDm += delta;
  const speed = Math.round(loadProgress.addedDm / elapsedSec);
  loadProgress.text = `拉取弹幕 ${loadProgress.current}/${loadProgress.total}`;
  loadProgress.detail = `${curr} | 当前 +${delta} | 累计 +${loadProgress.addedDm} | ${speed}/s`;
};

const withLoading = async (fn) => {
  if (!props.dmMgr) return;
  panelLoading.value = true;
  emit('update:loading', true);
  emit('set-error', '');
  try {
    await fn();
    return true;
  } catch (error) {
    const msg = String(error?.message || error);
    emit('set-error', msg);
    message.error(msg || '载入失败');
    return false;
  } finally {
    panelLoading.value = false;
    emit('update:loading', false);
  }
};

const emitSyncData = () => {
  const list = props.dmMgr?.data?.danmaku_list || [];
  const commandDms = props.dmMgr?.data?.danmaku_view?.commandDms || [];
  emit('sync-data', { list, commandDms });
  syncRetryErrorStats();
};

const loadDmXml = async () => {
  if (!props.dmMgr) return;
  let rise = 0;
  const ok = await withLoading(async () => {
    resetProgress();
    rise = Number(await props.dmMgr.getDmXml()) || 0;
    if (rise < 0) throw new Error('XML 载入失败，请检查稿件信息');
    emitSyncData();
  });
  if (!ok) return;
  const added = Math.max(0, rise);
  message.success(`XML 载入完成，新增 ${added.toLocaleString()} 条`);
};

const loadDmPb = async () => {
  if (!props.dmMgr) return;
  let rise = 0;
  const ok = await withLoading(async () => {
    startProgress();
    rise = Number(await props.dmMgr.getDmPb(updateProgress)) || 0;
    if (rise < 0) throw new Error('ProtoBuf 载入失败，请检查稿件信息');
    emitSyncData();
    resetProgress();
  });
  if (!ok) return;
  const added = Math.max(0, rise);
  message.success(`ProtoBuf 载入完成，新增 ${added.toLocaleString()} 条`);
};

const runAutoLoad = async () => {
  if (!props.dmMgr || panelLoading.value) return;
  if (autoLoadXml.value) {
    await loadDmXml();
  }
  if (autoLoadPb.value) {
    await loadDmPb();
  }
};

const loadDmHisRange = async () => {
  if (!props.dmMgr) return;
  const [start, end] = selectedDateRange.value || [];
  if (!start || !end) {
    emit('set-error', '请先选择起始与结束日期');
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    emit('set-error', '日期格式错误，应为 YYYY-MM-DD');
    return;
  }
  if (start > end) {
    emit('set-error', '起始日期不能晚于结束日期');
    return;
  }

  let rise = 0;
  const ok = await withLoading(async () => {
    startProgress();
    rise = Number(await props.dmMgr.getDmPbHisRange({ start, end }, updateProgress)) || 0;
    if (rise < 0) throw new Error('历史区间载入失败，请检查稿件信息');
    emitSyncData();
    resetProgress();
  });
  if (!ok) return;
  const added = Math.max(0, rise);
  message.success(`历史区间载入完成，新增 ${added.toLocaleString()} 条`);
};

const retryDmErrors = async () => {
  if (!props.dmMgr) return;
  if (!retryErrorTotal.value) {
    emit('set-error', '当前没有可重试的错误片段');
    return;
  }
  const ok = await withLoading(async () => {
    startProgress();
    await props.dmMgr.retryErrors(updateProgress);
    emitSyncData();
    resetProgress();
  });
  if (!ok) return;
  message.success('重试完成');
};

const clearDanmaku = () => {
  if (!props.dmMgr) return;
  props.dmMgr.clearData();
  emitSyncData();
  emit('set-error', '');
  message.success('已清除弹幕列表');
};

const downloadDanmakuData = (indentMode = 2) => {
  if (!props.dmMgr || !props.arcMgr) return;
  const data = {
    ...(props.dmMgr.data || {}),
    ...(props.arcMgr.data || {}),
  };
  const title = props.arcMgr?.info?.id?.replace(/[\\/:*?"<>|]/g, '_') || 'bds-data';
  const indent = indentMode === 'none' ? undefined : Number(indentMode) || 2;
  const text = indentMode === 'none' ? JSON.stringify(data) : JSON.stringify(data, null, indent);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const handleDownloadMenuSelect = (key) => {
  if (key === 'json:none') {
    downloadDanmakuData('none');
    return;
  }
  if (key === 'json:4') {
    downloadDanmakuData(4);
    return;
  }
  if (key === 'json:2') {
    downloadDanmakuData(2);
  }
};

const progressPercent = computed(() => {
  const total = Number(loadProgress.total || 0);
  const current = Number(loadProgress.current || 0);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((current / total) * 100)));
});

onMounted(async () => {
  resetDateRangeToDefault();
  syncDateRangeByLimits();
  syncRetryErrorStats();
  emitSyncData();

  if (props.dmMgr && autoLoadMgr !== props.dmMgr) {
    autoLoadMgr = props.dmMgr;
    await runAutoLoad();
  }

  emit('initial-load-finished');
});

defineExpose({
  runAutoLoad,
});

watch(autoLoadXml, (value) => {
  storage.set('dmLoader.autoLoadXml', Boolean(value));
});

watch(autoLoadPb, (value) => {
  storage.set('dmLoader.autoLoadPb', Boolean(value));
});

onBeforeUnmount(() => {
  resetProgress();
});

watch(() => props.dmMgr, () => {
  syncRetryErrorStats();
}, { immediate: true });
</script>

<template>
  <div class="bds-dm-loader-panel">
    <n-alert v-if="showLoadWarning" type="warning" closable style="margin-bottom: 12px;"
      @close="showLoadWarning = false">
      请勿短时间频繁载入，避免触发 B 站风控
    </n-alert>

    <n-flex :size="12" align="center" wrap class="bds-dm-loader-panel__action-row">
      <n-button class="bds-dm-loader-panel__btn" type="primary" size="small" :loading="panelLoading" @click="loadDmXml">
        载入 XML 实时弹幕
      </n-button>
      <n-checkbox v-model:checked="autoLoadXml" size="small">
        自动载入
      </n-checkbox>
      <n-tooltip trigger="hover" placement="top" :to="to">
        <template #trigger>
          <n-button size="tiny" quaternary circle class="bds-dm-loader-panel__hint-btn">
            <n-icon :component="InfoCircle" />
          </n-button>
        </template>
        实时弹幕池容量有限，通常是更近期的弹幕。
      </n-tooltip>
    </n-flex>

    <n-flex :size="12" align="center" wrap class="bds-dm-loader-panel__action-row">
      <n-button class="bds-dm-loader-panel__btn" type="primary" size="small" :loading="panelLoading" @click="loadDmPb">
        载入 ProtoBuf 弹幕
      </n-button>
      <n-checkbox v-model:checked="autoLoadPb" size="small">
        自动载入
      </n-checkbox>
      <n-tooltip trigger="hover" placement="top" :to="to">
        <template #trigger>
          <n-button size="tiny" quaternary circle class="bds-dm-loader-panel__hint-btn">
            <n-icon :component="InfoCircle" />
          </n-button>
        </template>
        二进制分片数据，B站当前使用的数据，通常覆盖更全。
      </n-tooltip>
    </n-flex>

    <n-flex :size="12" align="center" wrap class="bds-dm-loader-panel__action-row">
      <n-button class="bds-dm-loader-panel__btn" type="primary" size="small" :loading="panelLoading"
        @click="loadDmHisRange">
        载入区间历史弹幕
      </n-button>
      <n-date-picker :formatted-value="selectedDateRange" type="daterange" size="small" value-format="yyyy-MM-dd"
        :is-date-disabled="isHistoryDateDisabled" :to="to" :clearable="false" class="bds-dm-loader-panel__range"
        @update:formatted-value="onDateRangeUpdate" />
    </n-flex>

    <n-flex :size="12" align="center" wrap>
      <n-button size="small" type="error" @click="clearDanmaku">清除弹幕</n-button>
      <n-button-group>
        <n-button size="small" type="success" @click="downloadDanmakuData('none')">下载数据</n-button>
        <n-dropdown trigger="click" :options="downloadMenuOptions" placement="bottom-end" :to="to"
          @select="handleDownloadMenuSelect">
          <n-button size="small" type="success" aria-label="下载选项">
            ▼
          </n-button>
        </n-dropdown>
      </n-button-group>
      <n-button v-if="retryErrorTotal" size="small" type="warning" :loading="panelLoading" @click="retryDmErrors">
        重试错误
      </n-button>
      <n-tag v-if="retryErrorTotal" size="small" type="warning">
        待重试 日期 {{ retryErrorDates }} / 片段 {{ retryErrorSegments }}
      </n-tag>
    </n-flex>

    <n-flex align="center" :size="12" wrap class="bds-dm-loader-panel__progress-row">
      <n-progress v-if="loadProgress.visible" type="line" :percentage="progressPercent" :show-indicator="true"
        class="bds-dm-loader-panel__progress" />
      <n-text v-if="loadProgress.visible" depth="2">{{ loadProgress.text }}</n-text>
      <n-text v-if="loadProgress.visible && loadProgress.detail" depth="3">{{ loadProgress.detail }}</n-text>
    </n-flex>
  </div>
</template>
