<script setup>
import { useThemeVars } from 'naive-ui';
import { changeColor } from 'seemly';
import mountStyle from './style.cssr.js';

const props = defineProps({
  label: { type: String, default: '弹幕统计' },
});

const emit = defineEmits(['toggle']);

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);

const themeVars = useThemeVars();
const cssVars = computed(() => {
  const primary = themeVars.value.primaryColor;
  const cardColor = themeVars.value.cardColor;
  const bgHover = changeColor(cardColor, { alpha: 0.9 });
  const bgPressed = changeColor(cardColor, { alpha: 1 });
  const borderColor = changeColor(primary, { alpha: 0.9 });
  return {
    '--dm-launcher-icon-color': primary,
    '--dm-launcher-shadow-color': changeColor(primary, { alpha: 0.3 }),
    '--n-text-color': primary,
    '--n-text-color-hover': primary,
    '--n-text-color-pressed': primary,
    '--n-text-color-focus': primary,
    '--n-border': '1px solid transparent',
    '--n-border-hover': `1px solid ${borderColor}`,
    '--n-border-pressed': `1px solid ${borderColor}`,
    '--n-border-focus': `1px solid ${borderColor}`,
    '--n-color': changeColor(cardColor, { alpha: 0.3 }),
    '--n-color-hover': bgHover,
    '--n-color-pressed': bgPressed,
    '--n-color-focus': bgHover,
  };
});
</script>

<template>
  <n-button class="bds-entry-launcher" :style="cssVars" @click="emit('toggle')">
    <span class="bds-entry-launcher__text">{{ props.label }}</span>
    <span class="bds-entry-launcher__icon" aria-hidden="true">
      <svg viewBox="0 0 1024 1024" width="20" height="20">
        <path
          d="M691.2 928.2V543.1c0-32.7 26.5-59.3 59.2-59.3h118.5c32.7 0 59.3 26.5 59.3 59.2V928.2h-237z m192.6-385.1c0-8.2-6.6-14.8-14.8-14.8H750.5c-8.2 0-14.8 6.6-14.9 14.7v340.8h148.2V543.1zM395 157.8c-0.1-32.6 26.3-59.2 58.9-59.3h118.8c32.6 0 59.1 26.5 59.1 59.1v770.6H395V157.8z m44.4 725.9h148V157.9c0-8.1-6.5-14.7-14.7-14.8H454.1c-8.1 0.1-14.7 6.7-14.7 14.8v725.8zM98.6 394.9c0-32.7 26.5-59.2 59.2-59.3h118.5c32.7-0.1 59.3 26.4 59.3 59.1v533.5h-237V394.9z m44.5 488.8h148.2V394.9c0-8.2-6.7-14.8-14.8-14.8H158c-8.2 0-14.8 6.6-14.9 14.7v488.9z"
        />
      </svg>
    </span>
  </n-button>
</template>
