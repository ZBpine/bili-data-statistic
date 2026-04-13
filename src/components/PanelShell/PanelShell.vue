<script setup>
import { useThemeVars } from 'naive-ui';
import mountStyle from './style.cssr.js';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  size: {
    type: Number,
    default: 80,
  },
  error: {
    type: String,
    default: '',
  },
  zIndex: {
    type: Number,
    default: 800,
  },
});

const emit = defineEmits(['update:show']);

const styleMountTarget = inject('styleMountTarget', null);
mountStyle(styleMountTarget);
const themeVars = useThemeVars();

const panelEl = ref(null);

const panelStyle = computed(() => {
  const size = Math.max(20, Math.min(100, Number(props.size) || 80));
  const offset = (100 - size) / 2;
  return {
    left: `${offset}vw`,
    top: `${offset}vh`,
    width: `${size}vw`,
    height: `${size}vh`,
    zIndex: props.zIndex + 100,
    '--bds-panel-shell-bg': themeVars.value.baseColor || themeVars.value.cardColor || '#fff',
  };
});

const overlayStyle = computed(() => ({
  zIndex: props.zIndex,
}));

const closePanel = () => {
  emit('update:show', false);
};

defineExpose({
  panelEl,
});
</script>

<template>
  <div class="bds-panel-shell">
    <div v-show="show" class="bds-panel-shell__overlay" :style="overlayStyle" @click="closePanel" />
    <div v-show="show" class="bds-panel-shell__panel" :style="panelStyle">
      <div class="bds-panel-shell__panel-body" ref="panelEl">
        <n-alert v-if="error" type="error" :title="error" style="margin-bottom: 8px;" />
        <slot :panel-el="panelEl" />
      </div>
    </div>
  </div>
</template>
