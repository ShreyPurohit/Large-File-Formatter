# Change Log

All notable changes to the "large-file-formatter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.1.1] - 2026-03-11

### Fixed

- **JSON empty arrays and objects.** Empty `[]` and `{}` are now kept on one line instead of being split across lines with wrong indentation (e.g. `[\n  ]`). Fixes formatting of large JSON files with many empty arrays/objects (e.g. report-configuration-style documents).
- **Indentation after empty blocks.** Depth is no longer decremented when closing an empty block, so the next key keeps correct indentation.

### Changed

- **JSON formatter:** Empty-block handling now uses an explicit stack (`emptyBlockStack`) instead of inferring from the last output chunk, so behavior is robust against future formatter changes.
- **`isEmptyBlock`:** Bounds check added and documented; returns `false` when the next token is out of range.

### Added

- **Tests:** `report-configuration.json` format-and-validate test; JSON empty-block tests (root/nested/mixed); assertion that formatted output is parseable JSON.

## [0.1.0]

### Added

- **JSON formatting support.** Format large JSON files with the same worker-thread pipeline as XML (tokenize → format → validate → minimal edits).
- **Modular architecture for multiple languages.** Shared worker, shared types (`FormatOptions`, `FormatResult`, `Diagnostic`), and `common/edits` so adding more languages (e.g. HTML) is straightforward.
- **Per-language worker threshold.** New setting `large-file-formatter.jsonWorkerThresholdBytes` (default 131072); XML continues to use `workerThresholdBytes`.
- **Activation for JSON.** Extension activates on `onLanguage:json` in addition to `onLanguage:xml`.
- **Updated format success message.** Shows File Size, Tokens, Formatting Time, Worker Thread, and Memory Mode in a clear multi-line format.

### Changed

- **Single worker with language dispatch.** One worker at `dist/worker/formatWorker.js` handles both XML and JSON; request includes `language: 'xml' | 'json'`.
- **Extension:** Generic `FormatWorkerClient`, `toFormatOptions(language, options)`, and `createFormatProvider(language, workerClient)` for XML and JSON.
- **Build:** esbuild now bundles both the extension and the worker; `dist/worker` is created and populated on compile.
- **VS Code engine:** Lowered to `^1.60.0` for broader compatibility.
- **Package contents:** `files` in package.json set to `dist/**/*.js` so source maps are not included in the VSIX.

### Removed

- **Benchmark command.** `large-file-formatter.benchmarkCurrentDocument` and its registration have been removed.
- **XML-only edits module.** Edits logic lives only in `src/common/edits.ts`; `src/xml/edits.ts` removed.
- **.npmrc** with deprecated `enable-pre-post-scripts` (was causing npm warning).

---

## [0.0.1]

- Initial release of Large File Formatter.
- Added XML document formatting support.
- Added large-file performance path using worker-thread formatting.
- Added structural validation with safe fallback to original content.
