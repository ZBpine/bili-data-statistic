<script setup>
import mountStyle from './style.cssr.js';
import { useThemeVars } from 'naive-ui';

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);
const themeVars = useThemeVars();

const props = defineProps({
  links: {
    type: Array,
    default: () => [],
  },
});

const qrBackgroundColor = computed(() => {
  return themeVars.value.baseColor || themeVars.value.cardColor || '#fff';
});

const qrColor = computed(() => {
  return themeVars.value.textColorBase || '#000';
});

const openLink = (url) => {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const normalizedLinks = computed(() => {
  return (Array.isArray(props.links) ? props.links : [])
    .map((item, index) => {
      const url = String(item?.url || '').trim();
      const title = String(item?.title || '').trim() || `Link ${index + 1}`;
      const icon = String(item?.icon || '').trim();
      if (!url) return null;
      return {
        key: `${title}-${url}`,
        url,
        title,
        icon,
      };
    })
    .filter(Boolean);
});
</script>

<template>
  <div class="bds-share-qrs">
    <div v-for="item in normalizedLinks" :key="item.key" class="bds-share-qrs__item" role="button" tabindex="0"
      :title="`打开 ${item.title}`" @click="openLink(item.url)" @keydown.enter.prevent="openLink(item.url)"
      @keydown.space.prevent="openLink(item.url)">
      <n-text depth="2" class="bds-share-qrs__title">{{ item.title }}</n-text>
      <n-qr-code :value="item.url" type="svg" :size="64" :padding="10" :icon-src="item.icon || undefined"
        :icon-size="16" :background-color="qrBackgroundColor" :color="qrColor" />
    </div>
  </div>
</template>
