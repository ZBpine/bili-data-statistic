import { toDateString } from './utils';

const dateChart = {
  key: 'date',
  title: '发送日期分布',
  render() {
    const data = this.ctx.items || [];
    const countMap = {};
    for (const item of data) {
      const date = toDateString(Number(item?.ctime || 0) * 1000);
      countMap[date] = (countMap[date] || 0) + 1;
    }

    const sorted = Object.entries(countMap).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const x = sorted.map(([date]) => date);
    const y = sorted.map(([, count]) => count);
    const totalDays = x.length;
    const startIdx = Math.max(0, totalDays - 30);

    const hasDataZoom = totalDays > 1;

    this.instance.setOption({
      title: { text: '发送日期分布' },
      tooltip: {},
      xAxis: { type: 'category', data: x },
      yAxis: { type: 'value', name: '弹幕数量' },
      dataZoom: hasDataZoom
        ? [
          {
            type: 'slider',
            startValue: startIdx,
            endValue: Math.max(0, totalDays - 1),
            xAxisIndex: 0,
            height: 20,
          },
        ]
        : [],
      series: [
        {
          type: 'bar',
          data: x.map((date, idx) => ({ value: y[idx], __selectionValue: date })),
          label: { show: true, position: 'top' },
        },
      ],
    });
  },
  selection: {
    source: 'chart:date',
    template: '日期 {value}',
    getValue: (params) => params?.data?.__selectionValue ?? params?.name,
    predicate: (item, value) => toDateString(Number(item?.ctime || 0) * 1000) === String(value || ''),
  },
};

export default dateChart;
