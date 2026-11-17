# Implementation Changelog

## 2026-11-17 — Rebrand + hybrid Rust scaffold

- Created `docs/` audit and product documentation set
- Updated `.gitignore` for Zyntheo/Rust/secrets
- Rewrote `product.json` for Zyntheo identity + new Windows GUIDs
- Renamed `src/vs/workbench/contrib/void` → `contrib/zyntheo` with semantic identifier updates
- Added storage fallback, command aliases, user-data migration service
- Added AppImage desktop entries for Zyntheo
- Scaffolded `rust/zyntheo-workspace` (core/ipc/fs/index/sidecar) — cargo tests passed
- Added feature-flagged Electron sidecar bridge
- **Did not push** to GitHub (approval gate)
