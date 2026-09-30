# Changelog

Versions match the **About** dialog inside the app. Dates are `YYYY/M/D`.
Chinese mirror: [zh-CN/CHANGELOG.md](zh-CN/CHANGELOG.md).

## v1.6 — 2026/9/6

- Fixed the monitor occasionally inserting blank lines for certain receive patterns.
- Refined the display of components in device connection management.
- Refined chart panel display and interaction logic.

## v1.5 — 2026/7/9

- Renamed "automatic hardware flow control" to **RTS/CTS 流控** to describe what it actually
  does.
- Rewrote TX/RX and newline-handling logic; improved monitor rendering and event handling.

## v1.4 — 2026/7/4

- Reworked the palette and flat-design styling, with light and dark themes separated.
- Reworked preset-send interaction: a switch now gates the global hotkeys.
- Added hover help for the parsing configuration.

## v1.3 — 2026/6/30

- Added **bar charts** with channel selection, axis scaling and auto range.
- `name` tag binding switched to trailing-number matching (`name0` ↔ `int0`), making rule
  syntax more flexible.
- Preset send accepts single-character hotkeys: press to send, inputs auto-select so replacing
  a value takes effect immediately.
- Fixed the historical version repository on GitHub; improved the offline experience and
  offline detection.
- Improved compact mode, spacing and panel consistency.
- Improved channel interaction, chart rendering, FFT channel filtering, and dynamic `name`
  field tracking.
- Improved timeline replay and the syncing/persistence of chart state during config import and
  export.
- Improved template parsing, send-data filtering, and checkbox styling.

## v1.2 — 2026/6/11

- Timed, trigger and preset send now preserve original bytes in hex mode; send matching and
  display logic unified.
- The advanced send area is height-adjustable by dragging, and module rows can be reordered by
  dragging.
- Preset items accept a description; the monitor shows send and match status markers.
- Improved hex-structure parsing: separator placeholders and footer-less wide matching.
- Improved the live results display: horizontal scrolling, expand and collapse.
- Fixed serial parameter changes not taking effect while connected.
- Added global configuration export, import and reset covering device, send, parser and chart
  settings.

## v1.1 — 2026/5/30

- Settings and input state are saved automatically and restored on the next load.
- Added the offline build: download it, run it anywhere, and the app detects that it is
  offline.
- Visual polish: dialogs, dropdown states, blurred backgrounds for floating panels on narrow
  screens.
- Added the About dialog with release notes, plus manual, GitHub and feedback links.

## v1.0 — 2026/5/24

- Initial release: serial monitor, device connection management with VID/PID display, framing
  configuration, hardware flow control and signal control.
- Automatic light/dark theming, and separate wide and narrow layouts.
- Auto-reconnect after unplug or connection loss.
- Release-on-blur, so other tools can take the port while the tab is unfocused.
- Structured parsing: text rules, hex structure tables, automatic rule detection, live results.
- Time-domain and frequency-domain (FFT) charts bound to parsed channels, with view range and
  auto-range controls.
- The timeline system: live freeze, recording, replay, import/export, and reusable parser
  configuration per capture.
- Timeline import/export of raw data as BIN/TXT/CSV and of parsed results as TXT/CSV.
- Manual, timed, trigger and preset send workflows.
