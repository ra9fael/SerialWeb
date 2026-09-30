# Fork provenance

SerialWeb was created and is maintained by **Conductance-lab**: author home page
<https://conductance-lab.xyz>, original repository
[`Conductance-lab/SerialWeb`](https://github.com/Conductance-lab/SerialWeb), original online
version <https://conductance-lab.xyz/SerialWeb/>.

This repository, [`ra9fael/SerialWeb`](https://github.com/ra9fael/SerialWeb), is **a fork of that
project**, maintained independently. It is not a GitHub *network* fork: the two histories are
separate, so no upstream commit object exists in this repository. The provenance is therefore
declared here and in the app's **About** dialog instead of by Git metadata.

The design of SerialWeb and every line of code up to the divergence point is the original
author's. What this repository added after it is listed under
[what this fork adds](#what-this-fork-adds). Both are covered by the same
[license](#license).

- [Divergence point](#divergence-point)
- [Where each build lives](#where-each-build-lives)
- [What this fork adds](#what-this-fork-adds)
- [Version numbering](#version-numbering)
- [License](#license)

Chinese mirror: [zh-CN/fork.md](zh-CN/fork.md).

## Divergence point

| | |
| --- | --- |
| Upstream project | [`Conductance-lab/SerialWeb`](https://github.com/Conductance-lab/SerialWeb) |
| Baseline commit | `e3f9200814` — upstream release `1.6`, 2026/9/6 |
| Baseline form | one `index.html` (≈ 615 KB, BOM-prefixed), byte-identical to what `conductance-lab.xyz/SerialWeb/` serves |
| Fork start | `0a6943e` — this repository's initial commit, 2026/9/30, tagged [`v0.1.0`](CHANGELOG.md) |

The fork start already differs from the baseline structurally: the monolith was split into the
source files this repository uses today ([Development](development.md#repository-layout) lists
them). Feature work on top of that baseline came afterwards and is recorded in the
[Changelog](CHANGELOG.md) from `v0.1.0` onward.

## Where each build lives

| | This fork | Upstream |
| --- | --- | --- |
| Source / issues | <https://github.com/ra9fael/SerialWeb> | <https://github.com/Conductance-lab/SerialWeb> |
| Online version | <https://ra9fael.github.io/SerialWeb/> | <https://conductance-lab.xyz/SerialWeb/> |
| Second online host | — (single Pages deployment) | <https://conductance-lab.github.io/SerialWeb/> |
| Manual & tutorials | [these docs](README.md) | <https://docs.conductance-lab.xyz/工具手册/SerialWeb工具手册> |
| Feedback | [GitHub issues](https://github.com/ra9fael/SerialWeb/issues) | <https://docs.qq.com/form/page/DU1B2RWVyZnJERHdq> |

`ra9fael.github.io` serves the file `build-release.py` produces, published by the GitHub Actions
workflow `.github/workflows/pages.yml` — see
[Cutting a release](development.md#cutting-a-release). It is a different program from the one
upstream hosts: its own version number, and the page-view counter that upstream's host uses is
never called from this build.

## What this fork adds

Relative to upstream `1.6` (`e3f9200814`):

- **Source layout** — the single `index.html` became `index.html` + `style.css` + `bootstrap.js`
  + `app.loader.js` + `app.core.js` + `app.terminal.js` + `app.main.js` + `vendor/xterm/`, with
  `build-release.py` inlining everything again into one distributable file. The **offline copy**
  download was rebuilt for that layout: the app re-fetches its own chunks and concatenates them.
- **Interactive terminal view** — an xterm.js based monitor mode with a fit addon, font and skin
  pickers, and local echo/history. Upstream `1.6` has no terminal mode.
- **Terminal font handling** — font families that are not installed are detected and greyed out
  instead of silently falling back; font, theme and size changes apply while the terminal is
  hidden; the size is configurable (8–48 px) with `Ctrl` + wheel zoom.
- **Bilingual interface** — 中文 / English / follow-the-system switching
  ([User guide](user-guide.md#layout-theme-and-panels)). Upstream is Chinese-only.
- **Release tooling** — one version constant enforced by the build, `tools/set-version.py` to cut
  a release, and GitHub Actions publishing to GitHub Pages.
- **This documentation set** — English at the root of `docs/`, mirrored in `docs/zh-CN/`.
- **A fresh version series**, starting at `v0.1.0`, for the reasons below.

## Version numbering

This repository is tagged from `v0.1.0`. Upstream numbered the same program `1.0`–`1.6`, so the
changelog keeps the upstream numbers for the entries that came from upstream and starts its own
series at the fork point: `v0.1.0` **is** upstream `v1.6` plus the layout split, and `v0.2.0` is
the first release cut only in this repository. [Changelog](CHANGELOG.md) states the rule and
`tools/set-version.py` writes it;
[Version numbering](development.md#version-numbering) covers the mechanics.

## License

Upstream declares **GNU Affero General Public License v3.0**, and this repository ships that text
verbatim in [`LICENSE`](../LICENSE). It applies to the whole tree: the upstream code before the
divergence point, this fork's additions after it, and the single-file build made from them.

- Vendored [xterm.js](https://xtermjs.org/) and its fit addon keep their own MIT license; the
  files under `vendor/xterm/` are unmodified, headers included.
- AGPL-3.0 §13 requires that people interacting with a modified program over a network can get
  the source. The hosted build therefore links back to this repository from the ☰ menu and from
  the About dialog.
- As in the license text, no warranty is offered. Report bugs in *this* fork through
  [this repository's issues](https://github.com/ra9fael/SerialWeb/issues); bugs in the original
  project belong to its author.
