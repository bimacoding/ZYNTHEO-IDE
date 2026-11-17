# Rust Performance Benchmarks

**Policy:** Do not claim Electron RAM/CPU improvements without app-level measurements.

## Process-level compare (2026-11-18, macOS)

Command: `npm run bench-zyntheo-sidecar` (defaults to `./src`)

Latest run (via `npm run verify-zyntheo-rust`):

| Workload | Method | Wall clock | Files |
|----------|--------|------------|-------|
| `zyntheo-ide/src` (~5.4k files) | Python `os.walk` baseline (similar excludes) | **191.1 ms** | 5426 |
| same | Rust sidecar `list_files` (release) | **64.4 ms** | 5392 |

**Ratio:** Python walk ≈ **2.97×** Rust `list_files` on this machine/workload.

### Caveats (required)

- This is **not** Electron main/renderer/extension-host RSS.
- Python walk is a stand-in baseline, not `IFileService` / `directoryStrService`.
- File counts differ slightly (ignore rules / hidden handling).
- Re-run locally before citing numbers: `npm run bench-zyntheo-sidecar`.

## Sidecar micro ops

```bash
./scripts/rust-sidecar-bench.sh ./rust/zyntheo-workspace
```

## Application-level matrix

| Metric | TS-only | Hybrid Rust | Notes |
|--------|---------|-------------|-------|
| Electron main RSS | NOT_STARTED | NOT_STARTED | |
| Renderer RSS | NOT_STARTED | NOT_STARTED | |
| Extension host RSS | NOT_STARTED | NOT_STARTED | |
| Sidecar RSS | N/A | sampled via `resource_stats` | adaptive disable optional |
| Total app RSS | NOT_STARTED | NOT_STARTED | |
| Large workspace list_files (process) | baseline above | **measured** | process-level only |
