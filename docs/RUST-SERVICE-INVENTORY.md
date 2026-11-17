# Rust Service Inventory

Legend: **IMPLEMENTED** · **PARTIAL** · **SCAFFOLDED** · **NOT STARTED**

## Priority 1

| Component | Rust | TS fallback | Wired | Notes |
|-----------|------|-------------|-------|-------|
| Filesystem scanning | IMPLEMENTED (`zyntheo-fs`) | Yes (`IFileService`) | PARTIAL | Used via `list_files` / `list_tree` |
| Workspace tree generation | PARTIAL | Yes (ASCII tree in `directoryStrService`) | No for string tree | Rust returns flat relative paths |
| File watching | SCAFFOLDED | IDE file watcher | No | Next: `notify` with debounce + caps |
| Incremental workspace indexing | PARTIAL | N/A (no prior index) | Via IPC ops | Cache + root mtime refresh |

## Priority 2

| Component | Status |
|-----------|--------|
| Global code search | NOT STARTED |
| Context extraction | NOT STARTED |
| File metadata processing | PARTIAL (`file_metadata` helper) |
| Large repository traversal | PARTIAL (bounded walk) |

## Priority 3

| Component | Status |
|-----------|--------|
| Background task scheduling | SCAFFOLDED (sync dispatch + cancel map) |
| Process lifecycle management | IMPLEMENTED (TS client) |
| Resource monitoring | NOT STARTED |

## Electron / TS bridge

| Item | Status |
|------|--------|
| `ZyntheoRustSidecar` | IMPLEMENTED |
| Main service + `zyntheo-channel-rust` | IMPLEMENTED |
| Renderer `IZyntheoRustService` | IMPLEMENTED |
| Feature flag `ZYNTHEO_RUST_SERVICES=1` | IMPLEMENTED |
| Packaged binary in release builds | NOT STARTED |
