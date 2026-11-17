# Implementation Changelog

## 2026-11-18 — Phase 2/3 complete + ALL_PASS evidence

- Index dedupe: `list_files` → `list_files_deduped` (`cache_hit`)
- `JobGate` on heavy sidecar ops; `resource_stats` (RSS / jobs / index / watches)
- TS adaptive disable: `ZYNTHEO_RUST_MAX_RSS_BYTES` + LIMIT_EXCEEDED streak → `adaptive_disabled`
- Packaging: gulp embeds `resources/helpers/zyntheo-sidecar` when staged; preLaunch optional build
- Verify suite: `npm run verify-zyntheo-rust` → ALL_PASS (cargo + integration + compile + bench ~2.97×)
- **No GitHub push** without approval

## 2026-11-18 — Wire Rust search into AI tools

- `toolsService.search_for_files` / `search_pathnames_only` try Rust sidecar when `ZYNTHEO_RUST_SERVICES=1` and folders are `file://`
- On disable/failure → unchanged VS Code `ISearchService` path
- `search_in_file` stays model/TS (open-editor accurate)
- **No GitHub push** without approval

## 2026-11-18 — Phase 1 finish + Phase 2 search/metadata

- `zyntheo-search`: bounded content search IPC (`search`)
- `stat_paths` batch metadata
- Stage sidecar to `resources/helpers/` (+ gitignore binary)
- Process-level bench: Rust `list_files` ~2.18× vs Python walk on `./src` (~5.4k files)
- Integration: 11 checks PASS; `cargo test` + `npm run compile` 0 errors
- **No GitHub push** without approval

## 2026-11-18 — Phase 1 watch + packaging hooks

- Added `zyntheo-watch` (debounced notify, bounded queues, poll IPC)
- Ops: `watch_start` / `watch_poll` / `watch_stop` wired through sidecar + TS channel
- `npm run build-zyntheo-sidecar` stages binary to `.build/zyntheo-sidecar/`
- `npm run test-zyntheo-sidecar` integration checks (version mismatch, watch, respawn)
- Decision: ASCII `directoryStr` stays TypeScript; Rust remains bulk listing/index/watch
- **No GitHub push** without approval

## 2026-11-17 — Rust hybrid engineering pass (post-rebrand)

- Source-level review documented in `docs/RUST-SIDECAR-REVIEW.md`
- IPC protocol v1 envelopes (id, op, error codes, health, shutdown, cancel)
- FS: exclude-aligned walk + `list_files`; index cache with mtime refresh
- TS sidecar client: timeout, restart budget, modes A–H, stderr diagnostics
- Electron main service + `zyntheo-channel-rust`; renderer `IZyntheoRustService`
- Optional Rust path in `getAllURIsInDirectory` (TS fallback preserved)
- Docs: IPC, inventory, fallback, benchmarks, resources, roadmap
- Bench helper: `scripts/rust-sidecar-bench.sh` (sidecar-only timings)
- **No GitHub push** without explicit approval

## 2026-11-17 — Rebrand + hybrid Rust scaffold

- Created `docs/` audit and product documentation set
- Updated `.gitignore` for Zyntheo/Rust/secrets
- Rewrote `product.json` for Zyntheo identity + new Windows GUIDs
- Renamed `src/vs/workbench/contrib/void` → `contrib/zyntheo` with semantic identifier updates
- Added storage fallback, command aliases, user-data migration service
- Added AppImage desktop entries for Zyntheo
- Scaffolded `rust/zyntheo-workspace` (core/ipc/fs/index/sidecar)
- Added feature-flagged Electron sidecar bridge
