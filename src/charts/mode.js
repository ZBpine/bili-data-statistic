import { modeLabelMap } from './utils';

const modeChart = {
  key: 'mode',
  title: '弹幕类型分布',
  getLabel(mode) {
    return `${mode}-${modeLabelMap[mode] || '未知类型'}`;
  },
  getMenuItems() {
    return [{ getName: (item) => `类型：${this.getLabel(item?.mode)}` }];
  },
  selection: {
    source: 'chart:mode',
    template: '类型 {value}',
    getValue: (params) => params?.data?.__selectionValue ?? params?.name,
    formatValue: (value) => `${value}-${modeLabelMap[value] || '未知类型'}`,
    predicate: (item, value) => Number(item?.mode) === Number(value),
  },
  render() {
    const data = this.ctx.items || [];
    const countMap = {};
    for (const item of data) {
      const key = Number(item?.mode);
      countMap[key] = (countMap[key] || 0) + 1;
    }

    const keys = Object.keys(countMap).map((key) => Number(key)).sort((a, b) => a - b);
    const xData = keys.map((key) => this.getLabel(key));
    const yData = keys.map((key) => countMap[key]);

    this.instance.setOption({
      title: { text: '弹幕类型分布' },
      tooltip: {},
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value', name: '弹幕数' },
      series: [
        {
          type: 'bar',
          data: yData.map((count, idx) => ({ value: count, __selectionValue: keys[idx] })),
          label: { show: true, position: 'top' },
        },
      ],
    });
  },
};

export default modeChart;
