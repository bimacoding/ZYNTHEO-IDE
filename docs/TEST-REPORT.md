# Test Report

Tanggal verifikasi lokal: 2026-11-17 (macOS darwin 25.2.0, Node 20.18.2 via nvm, Apple clang 21).

| Suite | Command | Result | Notes |
|-------|---------|--------|-------|
| Rust workspace unit tests | `cd rust/zyntheo-workspace && cargo test --workspace` | PASSED | 5 tests (sebelumnya) |
| Root npm install | `npm install --ignore-scripts` lalu rebuild native | PASSED | `@vscode/spdlog` butuh `CXXFLAGS=-DFMT_USE_CONSTEVAL=0` di clang 21 |
| `build/` npm install | `cd build && npm install --ignore-scripts` | PASSED | full install gagal di `tree-sitter` (Python 3.14/expat); ignore-scripts cukup untuk gulp |
| Extension deps | `node build/npm/postinstall.js` | PASSED | termasuk markdown-math katex |
| React build | `npm run buildreact` | PASSED | ESM bundles `zyntheo-*-tsx`; warning unused import saja |
| npm compile | `npm run compile` (gulp) | PASSED | 0 errors setelah perbaikan import `fileActions.contribution.ts` → `zyntheoSettingsPane` |
| Smoke | `npm run smoketest` | DEFERRED | belum dijalankan |
| Memory / RAM benchmarks | — | NOT_STARTED | |
| Cross-platform packaging | — | DEFERRED | |

## Regresi compile terkait rebrand

Satu error TypeScript ditemukan dan diperbaiki:

- `src/vs/workbench/contrib/files/browser/fileActions.contribution.ts` masih mengimpor `../../void/browser/voidSettingsPane.js` → diganti ke `../../zyntheo/browser/zyntheoSettingsPane.js` (`ZYNTHEO_OPEN_SETTINGS_ACTION_ID`), label menu File diperbarui.

Tidak ada error modul `contrib/void` lain di `src/` setelah perbaikan itu.

## Catatan lingkungan

- Jangan andalkan system Python 3.14 Homebrew untuk node-gyp (`pyexpat` / libexpat mismatch); gunakan `PYTHON=python3.12` bila rebuild native di `build/`.
- Push GitHub disetujui setelah verifikasi compile lokal (2026-11-17).
