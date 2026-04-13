const weightChart = {
  key: 'weight',
  title: '弹幕屏蔽等级分布',
  menuItems: [{ getName: (item) => `屏蔽等级：${item?.weight ?? '-'}` }],
  selection: {
    source: 'chart:weight',
    template: '屏蔽等级 {value}',
    getValue: (params) => params?.data?.__selectionValue ?? params?.name,
    predicate: (item, value) => Number(item?.weight) === Number(value),
  },
  render() {
    const data = this.ctx.items || [];
    const levelCount = {};
    for (const item of data) {
      const level = Number(item?.weight);
      levelCount[level] = (levelCount[level] || 0) + 1;
    }

    const keys = Object.keys(levelCount).map((key) => Number(key)).sort((a, b) => a - b);
    const xData = keys;
    const yData = keys.map((key) => levelCount[key]);

    this.instance.setOption({
      title: { text: '弹幕屏蔽等级分布' },
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

export default weightChart;
