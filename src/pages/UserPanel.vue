<script setup>
import { NbUserCard } from 'nb-ui';
import { useLoadingBar } from 'naive-ui';
import mountStyle from './UserPanel.style.cssr.js';
import { hashToMidByWorker } from '../workers/hashToMidWorker';

const props = defineProps({
  url: {
    type: String,
    default: '',
  },
  midHash: {
    type: String,
    default: '',
  },
  mode: {
    type: String,
    default: 'script',
  },
});

const styleMountTarget = inject('styleMountTarget', null);
const BDM = inject('BDM', null);
mountStyle(styleMountTarget);

const loading = ref(false);
const panelError = ref('');
const loadingBar = useLoadingBar();
const userPanelEl = ref(null);

const userCard = ref({});
const userMidHash = ref('');
const isReadonlyMode = computed(() => props.mode === 'readonly');

const normalizeHash = (value) => String(value || '').trim().toLowerCase();
const waitPaint = () => new Promise((resolve) => {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(resolve, 0);
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});


const loadUser = async () => {
  if (!BDM) {
    panelError.value = 'BDM 不可用';
    return;
  }
  const sourceUrl = String(props.url || '').trim();
  const sourceHash = normalizeHash(props.midHash);
  if (!sourceUrl && !sourceHash) return;

  loading.value = true;
  panelError.value = '';
  loadingBar.start();
  await nextTick();
  await waitPaint();
  try {
    let finalUrl = sourceUrl;
    let resolvedMid = '';

    if (sourceHash) {
      const converter = BDM?.BiliUser;
      if (typeof converter?.hashToMid !== 'function') {
        throw new Error('反查能力不可用');
      }
      const mid = await hashToMidByWorker(sourceHash);
      if (!mid || mid === -1) {
        throw new Error('未能查到用户ID或用户不存在');
      }
      resolvedMid = String(mid);
      finalUrl = `https://space.bilibili.com/${resolvedMid}`;
    }

    if (isReadonlyMode.value) {
      userCard.value = {
        card: {
          mid: resolvedMid,
          name: '查找结果',
          sign: '此ID通过弹幕哈希本地计算得出，非官方公开数据，请谨慎使用',
        }
      };
      userMidHash.value = '';
      if (typeof BDM.BiliUser.midToHash === 'function') {
        userMidHash.value = normalizeHash(BDM.BiliUser.midToHash(resolvedMid));
      }
      loadingBar.finish();
      return;
    }

    if (!BDM?.BiliUser) throw new Error('BDM 不可用');
    const userMgr = new BDM.BiliUser(finalUrl);
    const cardData = await userMgr.getCard(true);
    if (!cardData || typeof cardData !== 'object' || !cardData.card) {
      throw new Error('无用户信息');
    }

    const fetchedMidHash = normalizeHash(userMgr.getMidHash());
    if (sourceHash && fetchedMidHash && fetchedMidHash !== sourceHash) {
      throw new Error('用户信息校验失败，可能匹配到错误用户');
    }

    userCard.value = cardData;
    userMidHash.value = userMgr.getMidHash() || (resolvedMid ? BDM.BiliUser.midToHash(resolvedMid) : '');
    loadingBar.finish();
  } catch (error) {
    userCard.value = {};
    userMidHash.value = '';
    panelError.value = String(error?.message || error);
    loadingBar.error();
  } finally {
    loading.value = false;
  }
};

watch(() => [props.url, props.midHash, props.mode], () => {
  loadUser();
}, { immediate: true });
</script>

<template>
  <n-loading-bar-provider :to="userPanelEl || undefined">
    <div ref="userPanelEl" class="bds-user-panel">
      <n-flex vertical :size="8">
        <n-alert v-if="panelError" type="error" :title="panelError" />
        <n-spin :show="loading">
          <nb-user-card :user-card="userCard" :mid-hash="userMidHash" />
        </n-spin>
      </n-flex>
    </div>
  </n-loading-bar-provider>
</template>
