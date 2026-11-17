# Implementation Changelog

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
