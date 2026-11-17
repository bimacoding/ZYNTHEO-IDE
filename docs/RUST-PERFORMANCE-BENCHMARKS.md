# Rust Performance Benchmarks

**Status:** HARNESS ONLY — no application-level RAM claims yet.

## Policy

Do **not** claim memory/CPU improvements without reproducible numbers from identical workloads.

## Local micro-benchmark (sidecar)

```bash
# Build release sidecar
cd rust/zyntheo-workspace && cargo build --release -p zyntheo-sidecar

# Smoke + timing helper
./scripts/rust-sidecar-bench.sh /path/to/workspace
```

Records wall-clock for `list_tree` / `list_files` only (sidecar process).  
Does **not** measure Electron main/renderer/extension host.

## Application-level matrix (TODO)

| Metric | TS-only | Hybrid Rust | Notes |
|--------|---------|-------------|-------|
| Electron main RSS | NOT_STARTED | NOT_STARTED | |
| Renderer RSS | NOT_STARTED | NOT_STARTED | |
| Extension host RSS | NOT_STARTED | NOT_STARTED | |
| Sidecar RSS | N/A | NOT_STARTED | |
| Total app RSS | NOT_STARTED | NOT_STARTED | |
| Startup time | NOT_STARTED | NOT_STARTED | |
| Idle memory | NOT_STARTED | NOT_STARTED | |
| Large workspace list_files | NOT_STARTED | NOT_STARTED | |

### Workloads to use

- Small (<100 files)
- Medium (~5k files)
- Large (>50k files)
- Repeated file changes
- Long-running session
- Indexing under load

### Investigate when measuring

Duplicate scanning · duplicate indexing · redundant caches · IPC serialization · unbounded queues · thread/worker sprawl · leaks after workspace close · restart leaks.
