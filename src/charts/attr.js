const attrChart = {
  key: 'attr',
  title: '弹幕属性分布',
  refresh: true,
  chartMode: 'bit',
  actions: [
    {
      key: 'toggle-mode',
      icon: '⇄',
      title: '切换统计方式',
      method: 'toggleChartMode',
    },
  ],
  selection() {
    return {
      source: this.chartMode === 'bit' ? 'chart:attr:bit' : 'chart:attr:value',
      template: this.chartMode === 'bit' ? '弹幕属性 bit位 {value}' : '弹幕属性 {value}',
      getValue: (params) => params?.data?.__selectionValue ?? params?.name,
      formatValue: (value) => {
        const [kind, raw] = String(value || '').split(':');
        if (kind === 'bit') {
          if (raw === '-' || raw === '' || raw == null) return 'bit:-';
          return `bit:${raw}`;
        }
        if (kind === 'attr') return `${raw} ${this.getAttrBits(raw).str}`;
        return String(value || '');
      },
      predicate: (item, value) => {
        const [kind, raw] = String(value || '').split(':');
        const attr = Number(item?.attr ?? 0);
        if (kind === 'bit') {
          const bit = Number(raw);
          if (!Number.isFinite(bit) || bit < 0) return attr === 0;
          return (attr & (1 << bit)) !== 0;
        }
        if (kind === 'attr') {
          return attr === Number(raw);
        }
        return false;
      },
    };
  },
  getMenuItems() {
    return [{ getName: (item) => `属性：${this.getAttrBits(item?.attr).str}` }];
  },
  getAttrBits(attr) {
    const value = Number(attr);
    if (!Number.isInteger(value) || value === 0) return { str: 'bit:-', bits: [] };
    const bits = [];
    for (let i = 0; i < 32; i += 1) {
      if ((value & (1 << i)) !== 0) bits.push(i);
    }
    return bits.length ? { str: `bit:${bits.join('|')}`, bits } : { str: 'bit:-', bits: [] };
  },
  toggleChartMode() {
    this.chartMode = this.chartMode === 'attr' ? 'bit' : 'attr';
    if (this.instance?.clear) this.instance.clear();
    this.ctx.rerender();
  },
  render() {
    const data = this.ctx.items || [];

    if (this.chartMode === 'bit') {
      const bitCount = Array(32).fill(0);
      let zeroBitCount = 0;
      for (const item of data) {
        const bits = this.getAttrBits(item?.attr).bits;
        if (!bits.length) {
          zeroBitCount += 1;
        } else {
          for (const bit of bits) bitCount[bit] += 1;
        }
      }

      const labels = [];
      const counts = [];
      const selectionValues = [];
      if (zeroBitCount > 0) {
        labels.push('-');
        counts.push(zeroBitCount);
        selectionValues.push('bit:-');
      }
      for (let i = 0; i < 32; i += 1) {
        if (bitCount[i] <= 0) continue;
        labels.push(String(i));
        counts.push(bitCount[i]);
        selectionValues.push(`bit:${i}`);
      }

      this.instance.setOption({
        title: { text: '弹幕属性 bit位分布' },
        tooltip: {},
        xAxis: { type: 'category', data: labels, name: 'bit位' },
        yAxis: { type: 'value', name: '出现次数' },
        series: [
          {
            type: 'bar',
            data: counts.map((count, idx) => ({ value: count, __selectionValue: selectionValues[idx] })),
            label: { show: true, position: 'top' },
          },
        ],
      });
      return;
    }

    const attrCount = {};
    for (const item of data) {
      const attr = Number(item?.attr ?? 0);
      attrCount[attr] = (attrCount[attr] || 0) + 1;
    }
    const labels = Object.keys(attrCount).map((key) => Number(key)).sort((a, b) => a - b);
    const counts = labels.map((label) => attrCount[label]);
    const total = Math.max(1, counts.reduce((sum, count) => sum + count, 0));
    const percentages = counts.map((count) => ((count / total) * 100).toFixed(2));

    this.instance.setOption({
      title: { text: '弹幕属性分布' },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const attr = Number(params?.name);
          const idx = labels.indexOf(attr);
          return `属性值：${attr}<br/>数量：${params.value}<br/>占比：${percentages[idx]}%<br/>位说明：${this.getAttrBits(attr).str}`;
        },
      },
      legend: { bottom: 'bottom' },
      series: [
        {
          type: 'pie',
          radius: '50%',
          data: labels.map((label, idx) => ({
            name: String(label),
            value: counts[idx],
            __selectionValue: `attr:${label}`,
          })),
          label: {
            formatter: (params) => `${params.name}\n${percentages[params.dataIndex]}%`,
          },
        },
      ],
    });
  },
};

export default attrChart;
