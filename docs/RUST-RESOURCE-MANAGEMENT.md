# Rust Resource Management

## Limits (`ResourceLimits` default)

| Limit | Default |
|-------|---------|
| `max_files` | 50_000 |
| `max_depth` | 32 |
| `max_message_bytes` | 8 MiB |
| `max_file_bytes` | 2 MiB |
| `max_concurrency` | 2 (`JobGate`) |
| `default_timeout_ms` | 30_000 |

Client timeout override: `ZYNTHEO_RUST_TIMEOUT_MS`.

Adaptive RSS disable (client): `ZYNTHEO_RUST_MAX_RSS_BYTES` (0 = off).

## Guarantees today

- Walk stops at `max_files` / `max_depth` (truncated flag).
- Incoming IPC frames rejected over `max_message_bytes`.
- Per-request `CancelToken` (cancel op sets flag).
- Index cache capped (`max_cached_workspaces`, default 8) with eviction.
- Heavy ops (`list_tree`, `list_files`, `build_index`, `refresh_index`, `search`) enter `JobGate`.
- `resource_stats` exposes RSS (best-effort), active/max jobs, index/watch counts.
- Adaptive disable on high RSS or repeated `LIMIT_EXCEEDED` → TS fallback.
- Graceful `shutdown` op + process kill on dispose.
- No arbitrary shell from IPC.

## Design rule

Rust must not compete unnecessarily with the editor. Prefer bounded, cancelable, incremental work over “scan everything ASAP”.
