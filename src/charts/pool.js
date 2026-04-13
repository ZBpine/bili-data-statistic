import { poolLabelMap } from './utils';

const poolChart = {
  key: 'pool',
  title: '弹幕池分布',
  getLabel(pool) {
    const numericPool = Number(pool);
    if (!Number.isFinite(numericPool)) return '_-未知池';
    return `${numericPool}-${poolLabelMap[numericPool] ?? '未知池'}`;
  },
  getMenuItems() {
    return [{ getName: (item) => `弹幕池：${this.getLabel(item?.pool)}` }];
  },
  selection: {
    source: 'chart:pool',
    template: '弹幕池 {value}',
    formatValue: (value) => `${value}`,
    getValue: (params) => params?.data?.__selectionValue ?? params?.name,
    predicate: (item, value) => {
      const itemPool = Number(item?.pool);
      const selectedPool = Number(value);
      if (!Number.isFinite(selectedPool)) return !Number.isFinite(itemPool);
      return itemPool === selectedPool;
    },
  },
  render() {
    const data = this.ctx.items || [];
    const poolMap = {};
    for (const item of data) {
      const value = Number(item?.pool);
      const key = Number.isFinite(value) ? value : '_';
      poolMap[key] = (poolMap[key] || 0) + 1;
    }

    const keys = Object.keys(poolMap).sort((a, b) => {
      if (a === '_') return 1;
      if (b === '_') return -1;
      return Number(a) - Number(b);
    });
    const xData = keys.map((key) => this.getLabel(key));
    const yData = keys.map((key) => poolMap[key]);

    this.instance.setOption({
      title: { text: '弹幕池分布' },
      tooltip: {},
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value', name: '弹幕数量' },
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

export default poolChart;
