# Rust Service Inventory

Legend: **IMPLEMENTED** · **PARTIAL** · **SCAFFOLDED** · **NOT STARTED**

## Priority 1

| Component | Status | Notes |
|-----------|--------|-------|
| Filesystem scanning | IMPLEMENTED | `list_tree` / `list_files` |
| Workspace ASCII tree string | DEFERRED (TS) | Intentional |
| File watching | IMPLEMENTED | `watch_*` poll IPC |
| Incremental index | PARTIAL | mtime cache refresh |
| Packaging stage | IMPLEMENTED | `.build/` + `resources/helpers/` |
| Process-level list_files bench | MEASURED | see benchmarks doc |

## Priority 2

| Component | Status | Notes |
|-----------|--------|-------|
| Global code search | IMPLEMENTED | `search` op + AI tools `search_for_files` / `search_pathnames_only` (flagged) |
| File metadata batch | IMPLEMENTED | `stat_paths` |
| Context extraction | NOT STARTED | |
| Large repo traversal | PARTIAL | bounded walks |

## Priority 3

| Component | Status |
|-----------|--------|
| Background task scheduling | SCAFFOLDED |
| Process lifecycle | IMPLEMENTED |
| Resource monitoring | NOT STARTED |

## Commands

```bash
npm run build-zyntheo-sidecar
npm run test-zyntheo-sidecar
npm run bench-zyntheo-sidecar
cd rust/zyntheo-workspace && unset CARGO_TARGET_DIR && cargo test --workspace --target-dir ./target
```
