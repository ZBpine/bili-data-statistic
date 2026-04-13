const colorCustomChartExample = `({
  name: 'colorTreemapExample',
  title: '弹幕颜色分布',
  excludeWhite: true,
  actions: [{
    key: 'toggle-exclude-white',
    icon: '⬜',
    title: '排除白色',
    method: 'toggleExcludeWhite'
  }],
  selection: {
    source: 'chart:colorExample',
    template: '颜色 {value}',
    getValue: (params) => params?.data?.__selectionValue,
    formatValue(value) {
      const hex = '#' + ((Number(value) >>> 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
      return this.ctx.h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '2px' } }, [
        this.ctx.h('span', {
          style: {
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            border: '1px solid #00000033',
            background: hex,
            display: 'inline-block'
          }
        }),
        this.ctx.h('span', null, hex)
      ]);
    },
    predicate: (item, value) => Number(item?.color) === Number(value)
  },
  toggleExcludeWhite() {
    this.excludeWhite = !this.excludeWhite;
    this.ctx.rerender();
  },
  render() {
    const MAX = 50;
    const toHex = (v) => '#' + ((Number(v) >>> 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
    const textColor = (hex) => {
      const h = String(hex).replace('#', '');
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) >= 165 ? '#111111' : '#ffffff';
    };

    const data = this.ctx.items || [];
    const map = new Map();
    for (const item of data) {
      const color = Number(item?.color);
      if (!Number.isFinite(color)) continue;
      if (this.excludeWhite && (((color >>> 0) & 0xffffff) === 0xffffff)) continue;
      map.set(color, (map.get(color) || 0) + 1);
    }

    const sorted = [...map.entries()]
      .map(([color, count]) => ({ color, count, hex: toHex(color) }))
      .sort((a, b) => b.count - a.count);

    const top = sorted.slice(0, MAX);
    const rest = sorted.slice(MAX).reduce((sum, item) => sum + item.count, 0);
    const total = Math.max(1, data.length);

    const treeData = top.map((item) => ({
      name: item.hex,
      value: item.count,
      __selectionValue: item.color,
      itemStyle: { color: item.hex, borderColor: '#ffffff66', borderWidth: 1 },
      label: { color: textColor(item.hex) }
    }));
    if (rest > 0) {
      treeData.push({
        name: '其他',
        value: rest,
        __selectionValue: null,
        itemStyle: { color: '#8c8c8c', borderColor: '#ffffff66', borderWidth: 1 },
        label: { color: '#ffffff' }
      });
    }

    this.instance.setOption({
      title: { text: '弹幕颜色分布' },
      tooltip: {
        formatter: (params) => {
          const item = params?.data;
          if (!item) return '';
          const count = Number(item.value || 0);
          const ratio = ((count / total) * 100).toFixed(2);
          if (item.name === '其他') {
            return '颜色：其他<br/>次数：' + count.toLocaleString() + '<br/>占比：' + ratio + '%';
          }
          return '颜色：' + item.name + '<br/>次数：' + count.toLocaleString() + '<br/>占比：' + ratio + '%';
        }
      },
      series: [{
        type: 'treemap',
        roam: false,
        nodeClick: false,
        leafDepth: 1,
        breadcrumb: { show: false },
        label: { show: true, formatter: (params) => params?.data?.name || '' },
        upperLabel: { show: false },
        data: treeData
      }]
    });
  }
})`;

export default colorCustomChartExample;
