<p align="center">
  <img width="144px" src="https://cdn.jsdelivr.net/gh/ZBpine/bili-data-statistic@main/assets/icon.svg" />
</p>

<h1 align="center">B站弹幕统计</h1>
<p align="center">获取B站弹幕数据，并生成统计面板。</p>


## 安装使用

### UserScript
- [GreasyFork](https://greasyfork.org/zh-CN/scripts/534432)
- [ScriptCat](https://scriptcat.org/zh-CN/script-show-page/3750) 无法访问 `github`/`jsdelivr` 的可安装脚本猫版本

安装油猴脚本后，在B站（视频、番剧）页面左下角悬浮按钮点击查看弹幕统计。

### Page
- [Github Page](https://zbpine.github.io/bili-data-statistic/) 国内较难访问
- [Cloudflare Page](https://bili-data-statistic.pages.dev/cn/) 国内访问还行
- [EdgeOne Page](https://bds.zbpine.abrdns.com/cn/) 腾讯的服务，理论上国内是不能访问的（省的买域名），实际上大概率能访问

直接访问静态页面只能靠上传数据来查看统计面板，安装油猴脚本后访问则可以输入B站URL抓取数据。

## 主要特性

- 支持视频页与番剧页弹幕统计
- 支持 XML、ProtoBuf、历史区间弹幕加载
- 支持正则筛选、图表交互筛选
- 支持用户弹幕统计与 midHash 反查
- 支持下载弹幕 JSON、导出可离线打开的统计 HTML
- 支持生成截图（需打开外部页面才能生成截图）
- 支持自定义图表

![legend](https://cdn.jsdelivr.net/gh/ZBpine/bili-data-statistic@main/assets/legend.png)

## 3.0.0 版本更新说明

旧版本：[bili-danmaku-statistic](https://github.com/ZBpine/bili-danmaku-statistic)

- ElementPlus转向NaiveUI，支持切换主题色
- 面板挂载从 `iframe` 改为 `ShadowDOM`，大幅提升打开面板速度（副作用：html2canvas截图时因B站页面原因会卡很久，故现在只有打开外部页面才能截图）
- 其他小功能升级：
  - 图表筛选可多选
  - 词云改用jieba分词
  - 弹幕列表可排序

### 3.1.0 新增互动视频支持

![legend01](https://cdn.jsdelivr.net/gh/ZBpine/bili-data-statistic@main/assets/legend01.png)


## 项目地址

[![B站弹幕统计](https://img.shields.io/badge/GitHub-B站弹幕统计-black?style=flat&logo=github)](https://github.com/ZBpine/bili-data-statistic)

### 项目依赖
- [BiliDataManager](https://github.com/ZBpine/bili-data-manager)
- [nb-ui](https://github.com/ZBpine/bili-data-viewer)