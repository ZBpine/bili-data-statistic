<script setup>
import { changeColor } from 'seemly';
import { useThemeVars } from 'naive-ui';
import mountStyle from './UploadScreen.style.cssr.js';

const props = defineProps({
  hasData: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'readonly',
  },
  sourceUrl: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['open-panel', 'parsed-data', 'update:sourceUrl']);

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);

const themeVars = useThemeVars();
const uploadError = ref('');
const fileList = ref([]);
const sourceUrlModel = computed({
  get: () => String(props.sourceUrl || ''),
  set: (value) => {
    emit('update:sourceUrl', String(value || ''));
  },
});

const cssVars = computed(() => {
  const primary = themeVars.value.primaryColor || '#00a1d6';
  const base = themeVars.value.bodyColor || themeVars.value.baseColor || themeVars.value.cardColor || '#ffffff';
  return {
    '--bds-upload-screen-bg-base': base,
    '--bds-upload-screen-bg-base-transparent': changeColor(base, { alpha: 0 }),
    '--bds-upload-screen-bg-radial': changeColor(primary, { alpha: 0.18 }),
    '--bds-upload-screen-bg-accent': changeColor(primary, { alpha: 0.1 }),
    '--bds-upload-bg': changeColor(base, { alpha: 0.88 }),
    '--bds-upload-border': changeColor(primary, { alpha: 0.45 }),
    '--bds-upload-drag-border': primary,
    '--bds-upload-drag-shadow': `0 8px 24px ${changeColor(primary, { alpha: 0.24 })}`,
  };
});

const parseUploadText = (text) => {
  const parsed = JSON.parse(String(text || ''));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('上传数据不是有效对象');
  }
  return parsed;
};

const parseAndEmitFile = async (file) => {
  if (!file) throw new Error('未读取到上传文件');
  const text = await file.text();
  const parsed = parseUploadText(text);
  emit('parsed-data', parsed);
};

const handleUploadChange = async ({ file }) => {
  try {
    uploadError.value = '';
    await parseAndEmitFile(file?.file || file);
  } catch (error) {
    uploadError.value = String(error?.message || error || '上传数据解析失败');
  } finally {
    fileList.value = [];
  }
};

const handleUpdateFileList = (list) => {
  fileList.value = Array.isArray(list) ? list : [];
};

const handleDropCapture = async (event) => {
  try {
    uploadError.value = '';
    const file = event?.dataTransfer?.files?.[0];
    await parseAndEmitFile(file);
  } catch (error) {
    uploadError.value = String(error?.message || error || '上传数据解析失败');
  } finally {
    fileList.value = [];
  }
};

const openPanel = (nextUrl) => {
  if (nextUrl != null) {
    emit('update:sourceUrl', String(nextUrl || ''));
  }
  emit('open-panel');
};
</script>

<template>
  <div class="bds-upload-screen" :style="cssVars">
    <n-flex :size="8" :wrap="false" align="center" justify="center" class="bds-upload-screen__bar">
      <n-input v-if="props.mode !== 'readonly'" v-model:value="sourceUrlModel" placeholder="输入 B 站视频 / 番剧 / 用户页面 URL"
        style="flex: 1;" @keyup.enter="openPanel($event?.target?.value)" />
      <n-button v-if="props.hasData || props.sourceUrl" type="primary" @click="openPanel()">
        打开面板
      </n-button>
    </n-flex>
    <n-upload class="bds-upload-screen__uploader" :show-file-list="false" :default-upload="false" :max="1"
      accept="application/json,.json" :file-list="fileList" @update:file-list="handleUpdateFileList"
      @change="handleUploadChange">
      <n-upload-dragger class="bds-upload-screen__card" @drop.capture.stop.prevent="handleDropCapture"
        @dragover.capture.stop.prevent @dragenter.capture.stop.prevent @dragleave.capture.stop.prevent>
        <n-text style="font-size: 16px;">拖拽上传弹幕数据 JSON</n-text>
        <n-text depth="3">或点击选择文件</n-text>
      </n-upload-dragger>
    </n-upload>
    <n-alert v-if="uploadError" type="error" :title="uploadError" style="margin-top: 12px;" />
  </div>
</template>
