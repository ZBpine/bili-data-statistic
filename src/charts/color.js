const MAX_COLOR_NODES = 50;

const toHexColor = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '#000000';
  const rgb = (num >>> 0) & 0xffffff;
  return `#${rgb.toString(16).padStart(6, '0')}`.toUpperCase();
};

const getLabelTextColor = (hex) => {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return '#111111';
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luminance >= 165 ? '#111111' : '#ffffff';
};

const colorChart = {
  key: 'color',
  title: '弹幕颜色分布',
  excludeWhite: true,
  actions: [
    {
      key: 'toggle-exclude-white',
      icon: '⬜',
      title: '排除白色',
      method: 'toggleExcludeWhite',
    },
  ],
  selection: {
    source: 'chart:color',
    template: '颜色 {value}',
    getValue: (params) => params?.data?.__selectionValue,
    formatValue(value) {
      const hex = toHexColor(value);
      return this.ctx.h('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
        },
      }, [
        this.ctx.h('span', {
          style: {
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            border: '1px solid #00000033',
            background: hex,
            display: 'inline-block',
          },
        }),
        this.ctx.h('span', null, hex),
      ]);
    },
    predicate: (item, value) => Number(item?.color) === Number(value),
  },
  toggleExcludeWhite() {
    this.excludeWhite = !this.excludeWhite;
    this.ctx.rerender();
  },
  getMenuItems() {
    return [{ getName: (item) => `颜色：${toHexColor(item?.color)}` }];
  },
  render() {
    const data = this.ctx.items || [];
    const countMap = new Map();

    for (const item of data) {
      const key = Number(item?.color);
      if (!Number.isFinite(key)) continue;
      if (this.excludeWhite && ((key >>> 0) & 0xffffff) === 0xffffff) continue;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    const sorted = [...countMap.entries()]
      .map(([color, count]) => ({ color, count, hex: toHexColor(color) }))
      .sort((a, b) => b.count - a.count);

    const topList = sorted.slice(0, MAX_COLOR_NODES);
    const restCount = sorted.slice(MAX_COLOR_NODES).reduce((sum, item) => sum + item.count, 0);
    const total = Math.max(1, data.length);

    const treeData = topList.map((item) => ({
      name: item.hex,
      value: item.count,
      __selectionValue: item.color,
      itemStyle: {
        color: item.hex,
        borderColor: '#ffffff66',
        borderWidth: 1,
      },
      label: {
        color: getLabelTextColor(item.hex),
      },
    }));

    if (restCount > 0) {
      treeData.push({
        name: '其他',
        value: restCount,
        __selectionValue: null,
        itemStyle: {
          color: '#8c8c8c',
          borderColor: '#ffffff66',
          borderWidth: 1,
        },
        label: {
          color: '#ffffff',
        },
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
            return `颜色：其他<br/>次数：${count.toLocaleString()}<br/>占比：${ratio}%`;
          }
          return `颜色：${item.name}<br/>次数：${count.toLocaleString()}<br/>占比：${ratio}%`;
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          leafDepth: 1,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: (params) => params?.data?.name || '',
          },
          upperLabel: { show: false },
          data: treeData,
        },
      ],
    });
  },
};

export default colorChart;
