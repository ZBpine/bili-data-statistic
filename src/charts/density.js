import { defineComponent, ref } from 'vue';
import { formatProgress, parseProgressToSec, parseRangeValue } from './utils';

const densityChart = {
  key: 'density',
  title: '弹幕密度分布',
  refresh: true,
  labelText: '',
  labelPosition: 'end',
  rangeSelectionSec: null,
  _labelMarks: [],
  actions: [
    {
      key: 'set-label',
      icon: '📌',
      title: '添加标记',
      method: 'setLabel',
    },
    {
      key: 'range-filter',
      icon: '▭',
      title: '范围筛选',
      method: 'openRangeFilterDialog',
    },
  ],
  applyLabelText(text) {
    this.labelText = String(text || '');
    const timeRegex = /(\d{1,2}[:：]\d{2}(?:[:：]\d{2})?)/;
    const labels = [];
    for (const line of this.labelText.split('\n')) {
      const row = String(line || '').trim();
      if (!row) continue;
      const matched = row.match(timeRegex);
      if (!matched) continue;
      const sec = parseProgressToSec(matched[1]);
      if (!Number.isFinite(sec)) continue;
      const label = row.replace(matched[1], '').trim() || row;
      labels.push({ name: label, xAxis: sec });
    }
    this._labelMarks = labels;
    this.ctx.rerender?.();
  },
  setLabel() {
    const NInput = this.ctx.ui?.NInput;
    const NText = this.ctx.ui?.NText;
    const NRadioGroup = this.ctx.ui?.NRadioGroup;
    const NRadioButton = this.ctx.ui?.NRadioButton;
    const feedback = this.ctx.feedback;
    if (!NInput || !NText || !NRadioGroup || !NRadioButton || !feedback?.dialog) {
      const text = window.prompt('请输入标记（每行一个，格式 mm:ss 文本）', this.labelText || '');
      if (text == null) return;
      this.applyLabelText(text);
      return;
    }

    let inputText = String(this.labelText || '');
    let labelPos = String(this.labelPosition || 'end');
    feedback.dialog.create({
      title: '添加标记',
      positiveText: '应用',
      negativeText: '取消',
      content: () => this.ctx.h('div', [
        this.ctx.h(NText, { type: 'info' }, { default: () => '请输入标记时间和文本' }),
        this.ctx.h(NInput, {
          type: 'textarea',
          rows: 8,
          defaultValue: inputText,
          placeholder: '6:06 示例\n12:12 示例2',
          autofocus: true,
          style: 'margin: 12px 0px;',
          onUpdateValue: (value) => {
            inputText = String(value || '');
          },
        }),
        this.ctx.h('div', [
          this.ctx.h(NText, { type: 'info' }, { default: () => '标记位置：' }),
          this.ctx.h(NRadioGroup, {
            value: labelPos,
            size: 'small',
            style: 'margin-left: 8px; vertical-align: top;',
            onUpdateValue: (value) => {
              labelPos = String(value || 'end');
            },
          }, {
            default: () => [
              this.ctx.h(NRadioButton, { value: 'end' }, { default: () => '顶端' }),
              this.ctx.h(NRadioButton, { value: 'insideEnd' }, { default: () => '内部' }),
            ],
          }),
        ]),
      ]),
      onPositiveClick: () => {
        this.labelPosition = labelPos === 'insideEnd' ? 'insideEnd' : 'end';
        this.applyLabelText(inputText);
        return true;
      },
    });
  },
  getDurationSec() {
    const data = this.ctx.items || [];
    const maxProgressMs = Math.max(0, ...data.map((item) => Number(item?.progress || 0)));
    const fromArc = Number(this.ctx.arcMgr?.info?.duration || 0);
    if (fromArc > 0) return Math.max(1, Math.ceil(fromArc));
    return Math.max(1, Math.ceil(maxProgressMs / 1000));
  },
  normalizeRangeSec(rangeSec, maxSec) {
    const fallback = [0, maxSec];
    if (!Array.isArray(rangeSec) || rangeSec.length < 2) return fallback;
    const start = Math.max(0, Math.min(maxSec, Math.floor(Number(rangeSec[0]) || 0)));
    const end = Math.max(0, Math.min(maxSec, Math.floor(Number(rangeSec[1]) || 0)));
    return start <= end ? [start, end] : [end, start];
  },
  openRangeFilterDialog() {
    const NSlider = this.ctx.ui?.NSlider;
    const NInput = this.ctx.ui?.NInput;
    const feedback = this.ctx.feedback;
    const maxSec = this.getDurationSec();
    const initial = this.normalizeRangeSec(this.rangeSelectionSec, maxSec);
    const secToText = (sec) => formatProgress(Number(sec || 0) * 1000);

    if (!NSlider || !NInput || !feedback?.dialog) {
      const text = window.prompt('请输入范围（秒），格式：start,end', `${initial[0]},${initial[1]}`);
      if (!text) return;
      const parts = String(text).split(',').map((v) => Number(v.trim()));
      if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return;
      const [startSec, endSec] = this.normalizeRangeSec(parts, maxSec);
      this.rangeSelectionSec = [startSec, endSec];
      this.applyRangeFilter(startSec * 1000, endSec * 1000);
      this.ctx.rerender?.();
      return;
    }

    const rangeSecRef = ref([...initial]);
    const startTextRef = ref(secToText(initial[0]));
    const endTextRef = ref(secToText(initial[1]));
    const startEditingRef = ref(false);
    const endEditingRef = ref(false);

    const syncTextByRange = (force = false) => {
      if (force || !startEditingRef.value) {
        startTextRef.value = secToText(rangeSecRef.value[0]);
      }
      if (force || !endEditingRef.value) {
        endTextRef.value = secToText(rangeSecRef.value[1]);
      }
    };

    const syncRangeByInput = (type, text) => {
      const sec = parseProgressToSec(text);
      if (!Number.isFinite(sec)) return;
      const next = type === 'start'
        ? [sec, rangeSecRef.value[1]]
        : [rangeSecRef.value[0], sec];
      rangeSecRef.value = this.normalizeRangeSec(next, maxSec);
      syncTextByRange();
    };

    const finalizeInput = (type) => {
      if (type === 'start') startEditingRef.value = false;
      else endEditingRef.value = false;
      const text = type === 'start' ? startTextRef.value : endTextRef.value;
      const sec = parseProgressToSec(text);
      if (!Number.isFinite(sec)) return;
      const next = type === 'start'
        ? [sec, rangeSecRef.value[1]]
        : [rangeSecRef.value[0], sec];
      rangeSecRef.value = this.normalizeRangeSec(next, maxSec);
      syncTextByRange(true);
    };

    const Content = defineComponent({
      name: 'DensityRangeFilterDialogContent',
      setup: () => {
        return () => this.ctx.h('div', [
          this.ctx.h('div', { style: 'display: flex; align-items: center; gap: 8px;' }, [
            this.ctx.h(NInput, {
              value: startTextRef.value,
              placeholder: 'mm:ss 或 hh:mm:ss',
              onFocus: () => {
                startEditingRef.value = true;
              },
              onBlur: () => {
                finalizeInput('start');
              },
              onUpdateValue: (value) => {
                startTextRef.value = String(value || '');
                syncRangeByInput('start', startTextRef.value);
              },
            }),
            this.ctx.h('span', { style: 'color: var(--n-text-color-3);' }, '~'),
            this.ctx.h(NInput, {
              value: endTextRef.value,
              placeholder: 'mm:ss 或 hh:mm:ss',
              onFocus: () => {
                endEditingRef.value = true;
              },
              onBlur: () => {
                finalizeInput('end');
              },
              onUpdateValue: (value) => {
                endTextRef.value = String(value || '');
                syncRangeByInput('end', endTextRef.value);
              },
            }),
          ]),
          this.ctx.h(NSlider, {
            style: 'margin-top: 10px;',
            range: true,
            step: 1,
            min: 0,
            max: maxSec,
            value: rangeSecRef.value,
            formatTooltip: (value) => secToText(value),
            onUpdateValue: (value) => {
              if (!Array.isArray(value) || value.length < 2) return;
              rangeSecRef.value = this.normalizeRangeSec(value, maxSec);
              syncTextByRange();
            },
          }),
        ]);
      },
    });

    feedback.dialog.create({
      title: '范围筛选',
      positiveText: '筛选',
      negativeText: '取消',
      content: () => this.ctx.h(Content),
      onPositiveClick: () => {
        const startFromInput = parseProgressToSec(startTextRef.value);
        const endFromInput = parseProgressToSec(endTextRef.value);
        if (!Number.isFinite(startFromInput) || !Number.isFinite(endFromInput)) {
          feedback.message?.error?.('请输入正确时间格式（mm:ss 或 hh:mm:ss）');
          return false;
        }
        const [startSec, endSec] = this.normalizeRangeSec([startFromInput, endFromInput], maxSec);
        this.rangeSelectionSec = [startSec, endSec];
        this.applyRangeFilter(startSec * 1000, endSec * 1000);
        this.ctx.rerender?.();
        return true;
      },
    });
  },
  applyRangeFilter(startMs, endMs) {
    const start = Math.min(startMs, endMs);
    const end = Math.max(startMs, endMs);
    const value = `${start}-${end}`;
    this.ctx.stageFilter({
      source: 'chart:density',
      value,
      template: '时间段 {value}',
      formatValue: (raw) => {
        const parsed = parseRangeValue(raw);
        if (!parsed) return String(raw || '');
        return `${formatProgress(parsed.start)} ~ ${formatProgress(parsed.end)}`;
      },
      predicate: (item, raw) => {
        const parsed = parseRangeValue(raw);
        if (!parsed) return false;
        const progress = Number(item?.progress || 0);
        return progress >= parsed.start && progress <= parsed.end;
      },
    });
  },
  onClick({ params }) {
    const sec = Number(params?.value?.[0]);
    if (!Number.isFinite(sec)) return;
    const table = this.ctx.tableRef?.value;
    if (!table || typeof table.scrollToRow !== 'function') return;

    const sortState = table.getSortState?.();
    if (!sortState || sortState.key !== 'progress') {
      this.ctx.feedback?.message?.warning?.('请先按时间排序后再定位');
      return;
    }

    const items = this.ctx.tableItems || [];
    if (!Array.isArray(items) || !items.length) return;

    const target = sec * 1000;
    const idx = items.reduce((closestIdx, item, i) => {
      const currentDiff = Math.abs(Number(item?.progress || 0) - target);
      const closestDiff = Math.abs(Number(items[closestIdx]?.progress || 0) - target);
      return currentDiff < closestDiff ? i : closestIdx;
    }, 0);
    table.scrollToRow(idx);
  },
  render() {
    const data = this.ctx.items || [];
    const maxProgress = Math.max(60000, ...data.map((item) => Number(item?.progress || 0)));
    const durationSec = Number(this.ctx.arcMgr?.info?.duration || 0);
    const durationMs = durationSec > 0 ? durationSec * 1000 : Math.max(60000, maxProgress);

    const allowedIntervals = [1, 2, 3, 4, 5, 6, 10, 15, 20, 30];
    let intervalMs;
    if (durationSec > 0) {
      let roughInterval = durationSec / 60;
      let zoom = 1000;
      while (roughInterval > 45) {
        roughInterval /= 60;
        zoom *= 60;
      }
      const nearest = allowedIntervals.reduce((a, b) => (
        Math.abs(b - roughInterval) < Math.abs(a - roughInterval) ? b : a
      ));
      intervalMs = zoom * nearest;
    } else {
      const targetBins = 90;
      intervalMs = Math.max(1000, Math.ceil(durationMs / targetBins / 1000) * 1000);
    }

    const binCount = Math.max(1, Math.ceil(durationMs / intervalMs));
    this._intervalMs = intervalMs;

    const bins = new Array(binCount).fill(0);
    for (const item of data) {
      const progress = Number(item?.progress || 0);
      const idx = Math.min(binCount - 1, Math.max(0, Math.floor(progress / intervalMs)));
      bins[idx] += 1;
    }

    const lineData = bins.map((count, idx) => {
      const sec = Math.floor((idx * intervalMs) / 1000);
      return [sec, count];
    });

    const markLineData = [];
    for (const mark of this._labelMarks || []) {
      markLineData.push(mark);
    }

    const stagedFilter = this.ctx.stagedFilter || null;
    const isDensityStaged = stagedFilter?.source === 'chart:density';
    const normalizedRange = this.normalizeRangeSec(this.rangeSelectionSec, Math.ceil(durationMs / 1000));
    const hasRangeHighlight = isDensityStaged
      && Array.isArray(this.rangeSelectionSec)
      && this.rangeSelectionSec.length >= 2;
    const markAreaData = hasRangeHighlight
      ? [[{ xAxis: normalizedRange[0] }, { xAxis: normalizedRange[1] }]]
      : [];

    this.instance.setOption({
      title: { text: '弹幕密度分布' },
        tooltip: {
          trigger: 'axis',
          formatter: (items) => {
            const current = items?.[0];
            if (!current) return '';
            const sec = Number(Array.isArray(current.value) ? current.value[0] : current.axisValue || 0);
            const count = Number(Array.isArray(current.value) ? current.value[1] : current.value || 0);
            return `时间段：${formatProgress(sec * 1000)}<br/>弹幕数：${count}`;
          },
        },
      xAxis: {
        type: 'value',
        name: '时间',
        min: 0,
        max: Math.ceil(durationMs / 1000),
        axisLabel: {
          formatter: (val) => formatProgress(Number(val) * 1000),
        },
      },
      yAxis: {
        type: 'value',
        name: '弹幕数量',
      },
      series: [
        {
          type: 'line',
          smooth: true,
          areaStyle: {},
          data: lineData,
          markLine: markLineData.length
            ? {
              silent: true,
              animation: false,
              symbol: 'none',
              data: markLineData,
              label: {
                position: this.labelPosition || 'end',
                formatter: '{b}',
              },
            }
            : null,
          markArea: markAreaData.length
            ? {
              silent: true,
              itemStyle: {
                color: 'rgba(255, 100, 100, 0.2)',
              },
              data: markAreaData,
            }
            : null,
        },
      ],
      });
  },
};

export default densityChart;
