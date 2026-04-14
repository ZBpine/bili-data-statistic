<script setup>
import { h } from 'vue';
import { TrashX } from '@vicons/tabler';
import { NButton, NIcon } from 'naive-ui';
import storage from '../../../utils/storage';

const DEFAULT_EXTERNAL_PANEL_OPTIONS = [
  {
    label: 'Github Page',
    value: 'https://zbpine.github.io/bili-data-statistic/',
  },
  {
    label: 'Cloudflare Page',
    value: 'https://bili-data-statistic.pages.dev/cn/',
  },
  {
    label: 'EdgeOne Page',
    value: 'https://bds.zbpine.abrdns.com/cn/',
  },
];
const EXTERNAL_PANEL_SELECTED_KEY = 'external.panelUrl.selected';
const EXTERNAL_PANEL_CUSTOM_LIST_KEY = 'external.panelUrl.customList';

const normalizeText = (value) => String(value || '').trim();

const uniqueUrlList = (list) => {
  const seen = new Set();
  const output = [];
  for (const item of list) {
    const text = normalizeText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(text);
  }
  return output;
};

const createOption = (url, label = url) => ({
  label,
  value: url,
});

const defaultOptionItems = DEFAULT_EXTERNAL_PANEL_OPTIONS.map((item) => createOption(item.value, item.label));

const defaultUrlList = defaultOptionItems.map((item) => item.value);

const customUrlList = ref(uniqueUrlList(storage.get(EXTERNAL_PANEL_CUSTOM_LIST_KEY, [])));
const optionItems = computed(() => {
  const seen = new Set();
  const output = [...defaultOptionItems];
  for (const item of defaultOptionItems) seen.add(item.value);
  for (const value of customUrlList.value) {
    const text = normalizeText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    output.push(createOption(text));
  }
  return output;
});
const optionList = computed(() => optionItems.value.map((item) => item.value));
const selectedUrl = ref('');

const persistCustomList = () => {
  storage.set(EXTERNAL_PANEL_CUSTOM_LIST_KEY, [...customUrlList.value]);
};

const persistSelected = (value) => {
  storage.set(EXTERNAL_PANEL_SELECTED_KEY, value);
};

const ensureCustomOption = (value) => {
  if (defaultUrlList.includes(value)) return;
  if (customUrlList.value.includes(value)) return;
  customUrlList.value = [...customUrlList.value, value];
  persistCustomList();
};

const applySelected = (value) => {
  const nextValue = value && typeof value === 'object' && 'value' in value
    ? value.value
    : value;
  const text = normalizeText(nextValue);
  if (!text) return;
  ensureCustomOption(text);
  selectedUrl.value = text;
  persistSelected(text);
};

const handleCreate = (value) => {
  const text = normalizeText(value);
  const fallback = selectedUrl.value || optionList.value[0] || defaultUrlList[0] || '';
  return createOption(text || fallback);
};

const initializeSelected = () => {
  const storedSelected = normalizeText(storage.get(EXTERNAL_PANEL_SELECTED_KEY, ''));
  selectedUrl.value = storedSelected || optionList.value[0] || '';
  if (selectedUrl.value) {
    persistSelected(selectedUrl.value);
  }
};

const removeCustomUrl = (url) => {
  const text = normalizeText(url);
  if (!text) return;
  const nextList = customUrlList.value.filter((item) => item !== text);
  if (nextList.length === customUrlList.value.length) return;
  customUrlList.value = nextList;
  persistCustomList();
  if (selectedUrl.value === text) {
    const fallback = optionList.value[0] || defaultUrlList[0] || '';
    selectedUrl.value = fallback;
    if (fallback) persistSelected(fallback);
  }
};

const renderOption = ({ node, option }) => {
  const optionValue = normalizeText(option?.value);
  const removable = Boolean(optionValue) && !defaultUrlList.includes(optionValue);
  if (!removable) return node;
  const handleDelete = (event) => {
    event.preventDefault();
    event.stopPropagation();
    removeCustomUrl(optionValue);
  };
  return h(
    'div',
    {
      style: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      },
    },
    [
      h('div', { style: { minWidth: 0, flex: 1 } }, [node]),
      h(
        NButton,
        {
          quaternary: true,
          circle: true,
          size: 'tiny',
          title: '删除自定义 URL',
          onClick: handleDelete,
          style: {
            position: 'absolute',
            right: '28px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#c03a3a',
            zIndex: 2,
          },
        },
        {
          icon: () => h(NIcon, null, { default: () => h(TrashX) }),
          default: () => null,
        },
      ),
    ],
  );
};

initializeSelected();

watch(optionList, () => {
  if (!optionList.value.length) return;
  if (optionList.value.includes(selectedUrl.value)) return;
  selectedUrl.value = optionList.value[0];
  persistSelected(selectedUrl.value);
});
</script>

<template>
  <n-space vertical :size="12">
    <n-alert type="info" :show-icon="false" title="输入 URL 后请在下拉列表中选择该项以添加" />
    <n-form label-placement="top">
      <n-form-item label="外部页面 URL" style="margin-bottom: 8px;">
        <n-select :value="selectedUrl" filterable tag :options="optionItems" :render-option="renderOption"
          placeholder="输入 URL 后在下拉中选择" :on-create="handleCreate" @update:value="applySelected" />
      </n-form-item>
    </n-form>
  </n-space>
</template>
