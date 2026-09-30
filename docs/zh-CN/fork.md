# 分叉来源

SerialWeb 由 **电导实验室（Conductance-lab）** 创作并维护：作者主页
<https://conductance-lab.xyz>，原始仓库
[`Conductance-lab/SerialWeb`](https://github.com/Conductance-lab/SerialWeb)，原始在线版本
<https://conductance-lab.xyz/SerialWeb/>。

本仓库 [`ra9fael/SerialWeb`](https://github.com/ra9fael/SerialWeb) 是**该项目的分叉（fork）**，
由 `ra9fael` 独立维护。它不是 GitHub 意义上的网络分叉：两条提交历史互不相干，本仓库里不存在任何
上游提交对象，因此来源关系写在这里以及应用内的 **关于** 弹窗中，而不是由 Git 元数据体现。

SerialWeb 的设计以及分叉点之前的每一行代码都属于原作者。本仓库在其之后新增的内容见
[本分叉新增内容](#本分叉新增内容)，二者适用同一份[许可证](#许可证)。

- [分叉点](#分叉点)
- [各版本的部署位置](#各版本的部署位置)
- [本分叉新增内容](#本分叉新增内容)
- [版本编号](#版本编号)
- [许可证](#许可证)

> 本文为[英文版](../fork.md)的中文镜像，逐节对应；如有出入以英文版为准。

## 分叉点

| | |
| --- | --- |
| 上游项目 | [`Conductance-lab/SerialWeb`](https://github.com/Conductance-lab/SerialWeb) |
| 基线提交 | `e3f9200814` —— 上游 `1.6` 版，2026/9/6 |
| 基线形态 | 单个 `index.html`（约 615 KB，带 BOM），与 `conductance-lab.xyz/SerialWeb/` 提供的文件逐字节一致 |
| 分叉起点 | `0a6943e` —— 本仓库的初始提交，2026/9/30，打了 [`v0.1.0`](CHANGELOG.md) 标签 |

分叉起点在结构上已经与基线不同：那个单体文件被拆分成本仓库今天使用的源码文件
（见[开发指南](development.md#仓库结构)的仓库结构一节）。在此基线之上的功能开发都记录在
[更新日志](CHANGELOG.md) 从 `v0.1.0` 开始的条目里。

## 各版本的部署位置

| | 本分叉 | 上游 |
| --- | --- | --- |
| 源码 / issue | <https://github.com/ra9fael/SerialWeb> | <https://github.com/Conductance-lab/SerialWeb> |
| 在线版本 | <https://ra9fael.github.io/SerialWeb/> | <https://conductance-lab.xyz/SerialWeb/> |
| 第二处在线托管 | ——（只有一处 Pages 部署） | <https://conductance-lab.github.io/SerialWeb/> |
| 手册与教程 | [本套文档](README.md) | <https://docs.conductance-lab.xyz/工具手册/SerialWeb工具手册> |
| 反馈 | [GitHub issues](https://github.com/ra9fael/SerialWeb/issues) | <https://docs.qq.com/form/page/DU1B2RWVyZnJERHdq> |

`ra9fael.github.io` 提供的是 `build-release.py` 产出的那个文件，由 GitHub Actions 工作流
`.github/workflows/pages.yml` 发布，步骤见[发布新版本](development.md#发布新版本)。它与上游托管的
程序是两个不同的版本：有自己的版本号，而且上游主机使用的那套页面访问量统计永远不会由本构建发出。

## 本分叉新增内容

相对于上游 `1.6`（`e3f9200814`）：

- **源码布局** —— 单个 `index.html` 变成 `index.html` + `style.css` + `bootstrap.js`
  + `app.loader.js` + `app.core.js` + `app.terminal.js` + `app.main.js` + `vendor/xterm/`，
  再由 `build-release.py` 重新内联成一个可交付的单文件。**下载离线版到本地** 也按这套布局重写：
  应用会重新抓取自己的分片并拼接。
- **交互式终端视图** —— 基于 xterm.js 的监视模式，带 fit 插件、字体与皮肤选择器、本地回显与历史。
  上游 `1.6` 没有终端模式。
- **终端字体处理** —— 未安装的字体族会被检测出来并置灰，不再静默回退成默认等宽字体；字体、主题、
  字号的改动在终端隐藏时也能生效；字号可调（8–48 px）并支持终端内 `Ctrl` + 滚轮缩放。
- **中英双语界面** —— 中文 / English / 跟随系统 切换
  （见[用户指南](user-guide.md#布局主题与面板)）。上游只有中文。
- **发布工具链** —— 由构建强制校验的单一版本号、用于切版本的 `tools/set-version.py`，以及通过
  GitHub Actions 发布到 GitHub Pages。
- **本套文档** —— 英文放在 `docs/` 根目录，中文在 `docs/zh-CN/` 逐文件镜像。
- **全新的版本序列**，从 `v0.1.0` 起算，理由见下一节。

## 版本编号

本仓库从 `v0.1.0` 开始打标签。上游把同一个程序编号为 `1.0`–`1.6`，因此更新日志里来自上游的条目
保留上游编号，从分叉点起另起一条序列：`v0.1.0` **就是**上游 `v1.6` 加上源码拆分，`v0.2.0` 是仅在
本仓库切出的第一个版本。[更新日志](CHANGELOG.md) 写明该规则并由 `tools/set-version.py` 执行；
具体机制见[版本号](development.md#版本号)。

## 许可证

上游声明采用 **GNU Affero 通用公共许可证 v3.0**（AGPL-3.0），本仓库在 [`LICENSE`](../../LICENSE)
中原样收录该许可证全文。它适用于整棵目录树：分叉点之前的上游代码、之后的分叉新增，以及由它们构建
出的单文件产物。

- 内置的 [xterm.js](https://xtermjs.org/) 及其 fit 插件仍按各自的 MIT 许可证授权，`vendor/xterm/`
  下的文件与其声明头未经修改。
- AGPL-3.0 第 13 条要求：通过网络与修改版程序交互的用户能够获得源码。因此 Pages 上的在线版本在
  ☰ 菜单和关于弹窗里都指回本仓库。
- 与许可证文本一致，不提供任何保证。本分叉的问题请提交到
  [本仓库的 issues](https://github.com/ra9fael/SerialWeb/issues)；原项目的反馈请交给原作者。
