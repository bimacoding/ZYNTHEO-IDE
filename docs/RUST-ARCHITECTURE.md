# Rust Architecture

**Status:** Hybrid Option E — protocol v1 + flagged integration  
**Long-term goal:** Rust as primary performance engine; Electron/TS UI preserved.

## Workspace

`rust/zyntheo-workspace/`

| Crate | Role | Maturity |
|-------|------|----------|
| `zyntheo-core` | Limits, cancel, error codes | TESTED |
| `zyntheo-ipc` | Length-prefixed JSON envelopes v1 | TESTED |
| `zyntheo-fs` | Bounded gitignore + exclude walk | TESTED |
| `zyntheo-index` | In-memory index + mtime refresh | TESTED |
| `zyntheo-sidecar` | stdio binary | IMPLEMENTED |

## Electron bridge

| Piece | Path |
|-------|------|
| Process client | `electron-main/zyntheoRustSidecar.ts` |
| Main service | `electron-main/zyntheoRustMainService.ts` |
| Channel | `zyntheo-channel-rust` (registered in `app.ts`) |
| Renderer proxy | `common/zyntheoRustService.ts` |

- Disabled unless `ZYNTHEO_RUST_SERVICES=1`
- Binary: `ZYNTHEO_SIDECAR_PATH` or `rust/zyntheo-workspace/target/release/zyntheo-sidecar`
- On failure → TypeScript fallback (see `docs/RUST-FALLBACK-STRATEGY.md`)

## Tests

```bash
cd rust/zyntheo-workspace
unset CARGO_TARGET_DIR
cargo test --workspace --target-dir ./target
cargo build --release -p zyntheo-sidecar --target-dir ./target
./scripts/rust-sidecar-bench.sh ./rust/zyntheo-workspace
```

## Docs index

- `RUST-SIDECAR-REVIEW.md`
- `RUST-IPC-PROTOCOL.md`
- `RUST-SERVICE-INVENTORY.md`
- `RUST-FALLBACK-STRATEGY.md`
- `RUST-PERFORMANCE-BENCHMARKS.md`
- `RUST-RESOURCE-MANAGEMENT.md`
- `RUST-MIGRATION-ROADMAP.md`
