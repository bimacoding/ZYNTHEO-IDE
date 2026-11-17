# Rust Architecture

**Status:** IMPLEMENTED scaffold — integration feature-flagged

## Workspace

`rust/zyntheo-workspace/`

| Crate | Role |
|-------|------|
| `zyntheo-core` | Limits, cancel token, errors, product constants |
| `zyntheo-ipc` | 4-byte BE length-prefixed JSON |
| `zyntheo-fs` | Bounded gitignore-aware tree walk |
| `zyntheo-index` | Snapshot index scaffold |
| `zyntheo-sidecar` | stdio binary |

## Electron bridge

`src/vs/workbench/contrib/zyntheo/electron-main/zyntheoRustSidecar.ts`

- Disabled unless `ZYNTHEO_RUST_SERVICES=1`
- Binary path: `ZYNTHEO_SIDECAR_PATH` or `rust/zyntheo-workspace/target/release/zyntheo-sidecar`
- On failure → callers use TypeScript fallback

## Tests

```bash
cd rust/zyntheo-workspace && cargo test --workspace
```

Result (2026-11-17): all crate unit tests passed.
