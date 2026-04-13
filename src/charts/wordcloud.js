const wordcloudChart = {
  key: 'wordcloud',
  title: '弹幕词云',
  expandedH: false,
  segmentMode: 'simple',
  minLen: 2,
  topN: 1000,
  actions: [
    {
      key: 'toggle-segment',
      icon: '📝',
      title: '切换分词模式',
      method: 'toggleSegmentMode',
    },
  ],
  selection: {
    source: 'chart:wordcloud',
    template: '包含词语 {value}',
    predicate: (item, value) => {
      const content = String(item?.content || '').toLowerCase();
      const keyword = String(value || '').toLowerCase();
      return Boolean(keyword) && content.includes(keyword);
    },
  },
  getModeLabel() {
    return this.segmentMode === 'jieba' ? 'jieba' : '普通';
  },
  toggleSegmentMode() {
    this.instance?.clear?.()
    this.segmentMode = this.segmentMode === 'jieba' ? 'simple' : 'jieba';
    this.ctx.feedback?.message?.success?.(`已切换到${this.getModeLabel()}分词`);
    this.ctx.rerender?.();
  },
  async render() {
    const data = this.ctx.items || [];
    const mode = this.segmentMode === 'jieba' ? 'jieba' : 'simple';
    const archiveId = String(this.ctx.arcMgr?.info?.id || '').trim();
    let list = [];

    const segmentWords = this.ctx.segmentWords;
    if (typeof segmentWords !== 'function') {
      this.ctx.feedback?.message?.error?.('分词服务不可用');
    } else {
      list = await segmentWords({
        mode,
        items: data,
        minLen: this.minLen,
        topN: this.topN,
        archiveId,
      });
    }

    this.instance?.setOption({
      title: { text: this.segmentMode === 'jieba' ? '弹幕词云[jieba分词]' : '弹幕词云' },
      tooltip: {},
      series: [
        {
          type: 'wordCloud',
          gridSize: 8,
          sizeRange: [12, 40],
          rotationRange: [0, 0],
          shape: 'circle',
          data: Array.isArray(list) ? list : [],
        },
      ],
    });
  },
};

export default wordcloudChart;
