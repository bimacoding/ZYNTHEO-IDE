# Rust Sidecar — Source-Level Review

**Date:** 2026-11-17  
**Architecture:** Hybrid Option E (Electron + TS primary; Rust optional sidecar)

## Verdict

| Area | Status before this pass | Status after this pass |
|------|-------------------------|------------------------|
| Sidecar binary | Scaffold + Ping/ListTree | **IMPLEMENTED** envelope protocol + health/shutdown/index |
| IPC framing | Length-prefix JSON (basic) | **IMPLEMENTED** v1 envelopes (id, op, error codes) |
| Electron spawn client | Scaffold, unused | **IMPLEMENTED** + channel to renderer |
| Wire into AI directory hot path | Not wired | **PARTIAL** — `getAllURIsInDirectory` only |
| File watching | Missing | **SCAFFOLDED / DEFERRED** (mtime-based index refresh only) |
| Global search / context extract | Missing | **NOT STARTED** (Priority 2) |
| App-level RAM benchmarks | Missing | **NOT STARTED** (harness docs only) |

## Inventory (source)

| Path | Reality |
|------|---------|
| `rust/zyntheo-workspace/crates/zyntheo-core` | Limits, cancel, error codes, exclude helpers — **TESTED** |
| `rust/zyntheo-workspace/crates/zyntheo-ipc` | Envelope + length-prefix — **TESTED** |
| `rust/zyntheo-workspace/crates/zyntheo-fs` | Bounded walk + list_files — **TESTED** |
| `rust/zyntheo-workspace/crates/zyntheo-index` | In-memory cache + stale refresh — **TESTED** (not FS watcher) |
| `rust/zyntheo-workspace/crates/zyntheo-sidecar` | stdio loop — **IMPLEMENTED** (integration via smoke script) |
| `electron-main/zyntheoRustSidecar.ts` | Lifecycle, timeout, restart budget, modes A–H — **IMPLEMENTED** |
| `electron-main/zyntheoRustMainService.ts` | Main DI service — **IMPLEMENTED** |
| `common/zyntheoRustService.ts` | Renderer ProxyChannel — **IMPLEMENTED** |
| `common/directoryStrService.ts` | TS tree string **unchanged**; URI list may call Rust | **PARTIAL** |

## Gaps called out honestly

1. **Tree string rendering** (`getDirectoryStrTool` / `getAllDirectoriesStr`) still TypeScript — Rust returns flat entry lists, not the ASCII tree contract.
2. **No native file watcher** yet — incremental index uses root mtime heuristic only.
3. **No packaging** of sidecar into `.app` / `.dmg` / AppImage — binary must be built locally (`cargo build --release`).
4. **No claim of RAM reduction** — measurements not run at application level.

## Security notes

- IPC ops are an allowlist (`ping`, `health`, `list_tree`, `list_files`, `build_index`, `refresh_index`, `cancel`, `shutdown`).
- **No shell execution** op exists.
- Diagnostics avoid dumping file contents; paths may appear in error codes as sanitized messages.
