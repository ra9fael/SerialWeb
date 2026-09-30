# 开发指南

> 本文为[英文版](../development.md)的中文镜像，逐节对应；如有出入以英文版为准。

## 仓库结构

```
index.html              Document shell: every panel, control and dialog. No inline app logic.
bootstrap.js            Runs before first paint: theme, body classes, favicon. Only pre-read script.
app.loader.js           Dev-mode chunk loader (fetch + concat + eval as one script).
app.lang.js             (~420 lines) Locale dictionaries: Chinese source string -> English.
                        Standalone script, not part of the shared closure.
app.core.js             (~2100 lines) Constants, `state`, `refs`, formatting, encoding, hex,
                        theme, layout, toasts, buffers, version/offline detection, analytics.
app.terminal.js         (~300 lines) xterm.js lifecycle, skins, echo/history, view switching.
app.main.js             (~8000 lines) Serial lifecycle, RX pipeline, monitor rendering, send
                        modules, timeline, parser, charts, persistence, wiring.
style.css               All styling, light/dark themes, compact layout.
vendor/xterm/           Vendored xterm.js + fit addon + css (no CDN, so offline works).
build-release.py        Produces dist/SerialWeb.html.
tools/                  Optional development helpers: cdp-check.mjs (headless-browser audit
                        driver), extract-i18n-keys.py (dictionary key lister). Not shipped.
docs/                   This documentation set (English at the root, zh-CN mirror).
```

没有打包工具、没有框架、开发也不需要有构建步骤——源码就是实际交付的文件。`node_modules/`、`dist/` 和 `.venv/` 都被 git 忽略；`dist/` 随时可以由 `build-release.py` 重新生成。

## 共享闭包约束

`app.core.js` 在第 1 行**打开**一个 IIFE（`(() => {`），`app.main.js` **关闭**它（`})();`），而 `app.terminal.js` 是位于两者之间的片段。拼接后它们是同一个函数体、同一个词法作用域。

一旦动这些源码，下面几点就会立刻产生影响：

- 三个文件**不能分开加载**——每个文件一个 `<script>` 标签会失败，因为闭包无法跨越标签。这正是 `app.loader.js` 存在的原因，也是构建只内联一份拼接结果的原因。
- 顶层的 `const`/`let`/`function` 名称必须在三个文件之间唯一；重复声明会让拼接结果出现 `SyntaxError`，应用会静默地永远启动不起来。
- 因为暂时性死区，顺序是有讲究的：`app.main.js` 可以在函数内部引用 `app.core.js` 的 `const`（调用时没问题），但反过来在顶层引用不行。新的顶层常量请放在 `app.core.js`。
- 绝不要引入 `import`/`export` 或第二个 `(function(){` 包装——它会破坏拼接约定，也会破坏构建。

### 为什么源码模式需要 HTTP

浏览器把每个 `<script src>` 当作独立的程序，所以 `app.loader.js` 会取回三个分片、用 `\n` 连接，并把结果作为一个内联 `<script>` 注入。`fetch()` 在 `file://` 下不可用，因此双击打开 `index.html` 只会看到一个遮罩，指向 `dist/SerialWeb.html`。此外 Web Serial 还要求安全上下文，所以 `file://` 本来也没法连接端口。开发时请从根目录起服务：

```sh
python -m http.server 8000     # http://localhost:8000/
```

## 全局对象与装配

`bootstrap.js` 定义了唯一有意保留的 `window.*` 接口：`__serialWebInitialPrefs`、`__serialWebInitialTheme`、`__applySerialWebInitialBodyClasses()`（由 `<body>` 顶部的内联脚本调用，因此首帧就带上正确的主题/面板类，不会闪一下）以及 `__setSerialWebFavicon()`。应用包不导出任何东西——没有控制台 API，DevTools 片段也碰不到内部。增加启动期职责时请扩展 `bootstrap.js`，而不是从应用代码往 `window` 上挂。

DOM 访问集中在 `refs` 映射里（`app.core.js`，大约第 58–205 行）：每个元素 id 一条，启动时解析一次。**在 `index.html` 里新增元素就必须补上对应的 `refs` 条目**——除此之外应用不会为面板元素去查询 DOM。少数 `refs.*` 名称用可选链读取，但既没有条目也没有对应元素（例如 `refs.statUptime`、`refs.extensionPanel`）；它们是失效的残留，可以安全删除。

IIFE 末尾的启动顺序：`initializeDefaults()` → `attachEventListeners()` → `trackSerialWebView()` → `tryInitialSerialConnectPrompt()`。

## 扩展点

有两个函数是整个应用的接缝：

| 方向 | 入口 | 保证 |
| --- | --- | --- |
| TX | `sendPayload(payload, source, options, meta)` | 字节计数、日志事件、标签元数据、`sendBusy` 串行化，以及原始分片记录。任何新的发送方都必须走它。 |
| RX | `queueRxBytes(bytes, timestamp, meta)` | 行切分、实时事件裁剪、记录，以及为解析/图表刷新置脏标记。 |

真正的 `writer.write()` 在 `performSerialWrite()` 里；`buildPayloadFrame()` 是唯一把发送框文本 + 十六进制模式 + 换行符选项变成字节的地方。`scheduleRefresh()` 把所有渲染合并进单个 `requestAnimationFrame`。

注意终端视图有意绕过 `queueRxBytes` 和 `sendPayload`（它经由 `sendTerminalBytes` 写出），因此不参与解析、绘图和录制。如果你要让新功能看到终端流量，就必须把它加到那条路径上。

在推断性能或竞态之前需要知道的定时器：

| 周期 | 用途 |
| --- | --- |
| 250 ms | 状态/计数时钟。 |
| 800 ms | `getSignals()` 输入轮询。 |
| 420 ms | 波特率字段在重开端口前的防抖。 |
| 500 ms | `localStorage` 写入防抖。 |
| 80 ms | 二进制结构定义重新解析的防抖。 |
| 1800 ms | 预设期望回复超时。 |
| 500 ms | 发送模式磁贴闪动。 |
| ≥ 100 ms | 自动发送周期。 |
| rAF | 派生数据、监视器与图表绘制。 |

## 构建发布产物

前置条件：Python 3，外加

| 工具 | 用于 | 缺少它时 |
| --- | --- | --- |
| `esbuild`（`npm install`） | 压缩拼接后的 JS | JS 原样内联，并输出 `WARN: esbuild not found`；文件仍然可用。 |
| `minify_html`（`pip install minify-html`） | 压缩 HTML 和 CSS | 输出不压缩，并给出警告。 |
| `node` | 校验压缩后的内联脚本 | 跳过校验（给出警告）。 |

```sh
npm install                                   # provides node_modules/.bin/esbuild
pip install minify-html                       # optional, further compression
python build-release.py                       # -> dist/SerialWeb.html
python build-release.py --no-minify           # readable output, fastest
```

这个脚本做的事：

1. 读取 `index.html`，把 `INLINE_ASSETS` 里每个已知资源标签替换为内联的 `<style>`/`<script>` 块。三个应用分片在压缩**之前**拼接，这样 esbuild 会把它们当作一个闭包来解析。
2. 把 JS 内部的 `</script` 转义成 `<\/script`，使内联字符串字面量无法终止该块。
3. 断言内联块之外不再残留任何本地 `src=`/`href=` 引用——新增样式表或脚本必须加入 `INLINE_ASSETS`，否则构建会明确失败。
4. 用 `minify_html` 压缩 HTML/CSS，并刻意设置 `minify_js=False`：minify-html 自带的 JS 压缩器会破坏块级作用域的 `const`/`let`（"Cannot access before initialization"）。JS 压缩属于 esbuild，它在更早的拼接源码阶段执行。
5. 对压缩文档中的每个内联脚本执行 `node --check`；**任何失败都会回退到未压缩的文档**，而不是交付一个坏掉的产物。

结果是一个自包含文件，可以从 `file://` 运行（仅界面——见[原因](#为什么源码模式需要-http)）。

## 验证改动

应用没有自动化测试。实际可行的检查流程是：

1. 重新构建，然后从根目录起服务，同时加载 `index.html`（源码模式）和 `dist/SerialWeb.html`（发布模式）——只在压缩后才会出现的 bug 只会在后者暴露。
2. 先看控制台：闭包被破坏时表现为一个 `SyntaxError` 加一个空白页面；某个分片加载失败时 `app.loader.js` 会设置 `document.documentElement.dataset.appLoadError`。
3. 用真实设备，或用浏览器的虚拟串口/回环 COM 端口对，把整个链路走一遍：连接、连接状态下改帧参数、DTR/RTS、十六进制发送往返、两个监视标签页。
4. 解析器：套用一条规则，确认卡片和图表，然后在实时数据上用 自动识别。
5. 时间线：REC → 停止 → 选中 → 拖动 → 导出 BIN/TXT/CSV → 重新导入 → 导出解析结果 CSV。
6. 持久化：重新加载页面，确认布局/主题/队列/图表都恢复了；然后 复制配置 → 重新加载 → 粘贴导入。
7. 布局：把窗口拖窄到 720 px 以下，并检查两种布局以及发送面板的拖拽手柄。
8. 两种语言：☰ → 语言 → English，检查界面外壳里是否还残留中文（语言选项本身、字体名与皮肤名属于预期），再切回 中文 检查是否有英文。标签变长是布局风险——监视器标题/计数那一行和 ☰ 菜单是最先挤不下的两处。

`tools/cdp-check.mjs` 把第 1、2、8 步自动化：它通过 CDP 驱动一个无依赖的 headless Edge，例如
`node tools/cdp-check.mjs --url http://127.0.0.1:8731/dist/SerialWeb.html --out audit --scenario i18n`，
输出一份 JSON 轨迹加一张截图，并报告控制台错误。场景有 `i18n`（语言往返与残留审计）、`term`（字体可用性、字号、Ctrl+滚轮、隐藏时生效）、`roundtrip` 和 `reset`。
`tools/extract-i18n-keys.py` 会从 `index.html` 与各分片重新生成 `app.lang.js` 的候选键表。

## 发布检查清单

1. 更新 `app.core.js` 里的 `VERSION`，以及 `index.html` 中版本弹窗文案里的那一份（标题、`在线版本` 标签，并新增一段 更新日志 —— 它们彼此是独立的字符串，每一个都要改）。版本相关的字符串本身都走带 `{{version}}` 占位符的 `t()`，因此不需要新增词条；但每一条 更新日志 文本本身就是一个键：要在 `app.lang.js` 里给它配上英文，否则英文界面会显示中文行。
2. 在 [CHANGELOG.md](../CHANGELOG.md)（英文）和 [CHANGELOG.md](CHANGELOG.md) 中补上对应条目。
3. 执行 `python build-release.py`，并对 `dist/SerialWeb.html` 做冒烟测试。
4. 发布到两个托管端点（`conductance-lab.xyz/SerialWeb/` 和 GitHub Pages 项目）。离线的 **下载离线版到本地** 链接和 `ONLINE_VERSION_URL` 是静态的——不存在更新源，因此只在页面加载时才做版本检查。
5. 给发布打标签；单文件产物很适合附在标签上。

## 文档

文档位于 `docs/`，英文在根目录，并在 `docs/zh-CN/` 下以完全相同的文件名做中文镜像。两棵树要保持同步：新增一节应当同时出现在两边；上面的锚点被其他文件链接引用，因此重命名标题就意味着要更新指向它的链接。界面已支持中英双语（☰ 菜单里的 中文 / English / 跟随系统），因此英文文档仍把每个标签写作 `English (中文)`。英文词条集中在 `app.lang.js`，以中文原文作为键（缺少词条时退回中文，不会显示键名）；引擎是 `app.core.js` 里的 `t()` / `translateDom()` / `setLocale()`，以及 `app.main.js` 里的 `renderTranslatedViews()`——切换语言后由它重绘所有可能带标签的视图。
