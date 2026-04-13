const hourChart = {
  key: 'hour',
  title: '发送时间分布',
  render() {
    const data = this.ctx.items || [];
    const hours = new Array(24).fill(0);
    for (const item of data) {
      const hour = new Date(Number(item?.ctime || 0) * 1000).getHours();
      hours[hour] += 1;
    }

    this.instance.setOption({
      title: { text: '发送时间分布' },
      tooltip: {},
      xAxis: { type: 'category', data: hours.map((_, i) => `${i}时`) },
      yAxis: { type: 'value', name: '弹幕数量' },
      series: [
        {
          type: 'bar',
          data: hours.map((count, hour) => ({ value: count, __selectionValue: hour })),
          label: { show: true, position: 'top' },
        },
      ],
    });
  },
  selection: {
    source: 'chart:hour',
    template: '每天 {value} 点',
    getValue: (params) => params?.data?.__selectionValue ?? Number.parseInt(params?.name, 10),
    predicate: (item, value) => new Date(Number(item?.ctime || 0) * 1000).getHours() === Number(value),
  },
};

export default hourChart;
