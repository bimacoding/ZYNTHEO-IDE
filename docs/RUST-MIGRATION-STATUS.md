# Rust Migration Status

| Component | Status |
|-----------|--------|
| Hybrid Option E | VERIFIED |
| `zyntheo-core` / `ipc` / `fs` / `index` / `watch` | TESTED |
| `zyntheo-search` | TESTED |
| Sidecar + integration script | PASSED |
| Channel + TS fallback A–H | IMPLEMENTED |
| `getAllURIsInDirectory` Rust path | FLAGGED (`ZYNTHEO_RUST_SERVICES=1`) |
| ASCII directory strings | TS (intentional) |
| Watch / search / stat_paths IPC | IMPLEMENTED |
| Index dedupe `list_files` (`cache_hit`) | PASSED |
| JobGate bounded concurrency | PASSED (`cargo test` + `resource_stats.jobs_max`) |
| `resource_stats` + adaptive disable | IMPLEMENTED / PASSED (policy + RSS sampling) |
| Stage binary to helpers | IMPLEMENTED |
| Installer gulp embed | IMPLEMENTED (`gulpfile.vscode.js` when binary present) |
| preLaunch optional sidecar build | IMPLEMENTED |
| Process-level list_files bench | MEASURED (~2.97× vs Python walk on `./src`) |
| App-level RAM before/after | NOT_STARTED (no false claims) |

## Latest PASS evidence (2026-11-18)

Command: `npm run verify-zyntheo-rust` → report `.build/zyntheo-rust-pass-report.txt`

- `cargo test --workspace` — **PASS** (incl. `job_gate_bounds_concurrency`)
- Integration — **PASS** (`resource_stats`, `list_files_cache_hit`, adaptive policy, helpers staged, …)
- `npm run compile` — **PASS** (0 errors)
- Bench — Rust `list_files` ~64.4 ms vs Python ~191.1 ms on `./src` (**~2.97×**)
