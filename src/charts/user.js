const userChart = {
  key: 'user',
  title: '用户弹幕统计',
  expandedH: false,
  actions: [
    {
      key: 'locate-user',
      icon: '⚲',
      title: '定位用户',
      method: 'locate',
    },
  ],
  selection: {
    source: 'chart:user',
    template: '用户 {value}',
    wrapTag: false,
    formatValue(value) {
      const hash = String(value || '').trim();
      if (!hash) return '-';
      const NButton = this.ctx.ui?.NButton;
      if (!NButton) return hash;
      return this.ctx.h(
        NButton,
        {
          text: true,
          onClick: (event) => {
            event?.stopPropagation?.();
            this.ctx.queryMidHash?.(hash);
          },
        },
        { default: () => hash },
      );
    },
    predicate: (item, value) => String(item?.midHash || '') === String(value || ''),
  },
  isValidMidHash(value) {
    return /^[0-9a-f]+$/i.test(String(value || '').trim());
  },
  getMenuItems() {
    return [
      {
        getName: (item) => `发送者：${item?.midHash || '-'}`,
        onSelect: (item) => {
          const hash = String(item?.midHash || '').trim();
          if (!hash) return;
          const el = this.ctx.element;
          if (el?.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          this.locateInChart(hash);
        },
      },
    ];
  },
  locate() {
    const NInput = this.ctx.ui?.NInput;
    const feedback = this.ctx.feedback;
    if (!NInput || !feedback?.dialog) {
      const value = window.prompt('请输入要定位的 midHash：', '');
      if (!value) return;
      this.locateInChart(String(value).trim());
      return;
    }

    let inputValue = '';
    feedback.dialog.create({
      title: '定位用户',
      positiveText: '定位',
      negativeText: '取消',
      content: () => this.ctx.h(NInput, {
        defaultValue: inputValue,
        placeholder: '请输入 midHash（十六进制）',
        autofocus: true,
        onUpdateValue: (value) => {
          inputValue = String(value || '');
        },
        onKeyup: (event) => {
          if (event?.key === 'Enter') event?.stopPropagation?.();
        },
      }),
      onPositiveClick: () => {
        const hash = String(inputValue || '').trim();
        if (!this.isValidMidHash(hash)) {
          feedback.message?.error?.('请输入正确的 midHash（十六进制格式）');
          return false;
        }
        this.locateInChart(hash);
        return true;
      },
    });
  },
  locateInChart(midHash) {
    if (!this.instance || !midHash) return;
    const feedback = this.ctx.feedback;
    const option = this.instance.getOption();
    const labels = option?.yAxis?.[0]?.data || [];
    const index = labels.indexOf(midHash);
    if (index < 0) {
      if (feedback?.dialog) {
        feedback.dialog.warning({
          title: '定位失败',
          content: `未在当前图表中找到用户 ${midHash}`,
          positiveText: '知道了',
        });
      } else {
        feedback?.message?.warning?.(`未在当前图表中找到用户 ${midHash}`);
      }
      return;
    }

    const scope = this.expandedH ? 20 : 8;
    const start = Math.min(labels.length - scope, Math.max(0, index - 3));
    const end = Math.min(labels.length - 1, start + scope - 1);

    this.instance.setOption({
      yAxis: {
        axisLabel: {
          formatter: (value) => {
            if (value === midHash) return `{highlight|${value}}`;
            return value;
          },
          rich: {
            highlight: { color: '#2080f0', fontWeight: 'bold' },
          },
        },
      },
      dataZoom: [{ startValue: start, endValue: end }],
    });

    feedback?.message?.success?.(`已定位到用户 ${midHash}`);
  },
  render() {
    const data = this.ctx.items || [];
    const countMap = {};
    for (const item of data) {
      const key = String(item?.midHash || '-');
      countMap[key] = (countMap[key] || 0) + 1;
    }

    const stats = Object.entries(countMap)
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count);

    const users = stats.map((item) => item.user);
    const counts = stats.map((item) => item.count);
    const maxCount = Math.max(1, ...counts);
    const scope = this.expandedH ? 20 : 8;

    this.instance.setOption({
      title: { text: '用户弹幕统计', subtext: `共 ${users.length} 位用户` },
      tooltip: {},
      grid: { left: 100 },
      xAxis: {
        type: 'value',
        min: 0,
        max: Math.ceil(maxCount * 1.1),
        scale: false,
      },
      yAxis: {
        type: 'category',
        data: users,
        inverse: true,
      },
      dataZoom: [
        {
          type: 'slider',
          yAxisIndex: 0,
          startValue: 0,
          endValue: users.length >= scope ? scope - 1 : users.length,
          width: 20,
        },
      ],
      series: [
        {
          type: 'bar',
          data: counts,
          label: {
            show: true,
            position: 'right',
            formatter: '{c}',
            fontSize: 12,
          },
        },
      ],
    });
  },
};

export default userChart;
