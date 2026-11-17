# Rust Resource Management

## Limits (`ResourceLimits` default)

| Limit | Default |
|-------|---------|
| `max_files` | 50_000 |
| `max_depth` | 32 |
| `max_message_bytes` | 8 MiB |
| `max_file_bytes` | 2 MiB |
| `max_concurrency` | 2 (reserved for future async pool) |
| `default_timeout_ms` | 30_000 |

Client timeout override: `ZYNTHEO_RUST_TIMEOUT_MS`.

## Guarantees today

- Walk stops at `max_files` / `max_depth` (truncated flag).
- Incoming IPC frames rejected over `max_message_bytes`.
- Per-request `CancelToken` (cancel op sets flag).
- Index cache capped (`max_cached_workspaces`, default 8) with eviction.
- Graceful `shutdown` op + process kill on dispose.
- No arbitrary shell from IPC.

## Not yet

- Async worker pool honoring `max_concurrency`.
- Sidecar-side wall-clock timeout (client enforces timeout today).
- Cross-workspace memory accounting dashboard.
- Automatic back-pressure when Electron is CPU-saturated.

## Design rule

Rust must not compete unnecessarily with the editor. Prefer bounded, cancelable, incremental work over “scan everything ASAP”.
