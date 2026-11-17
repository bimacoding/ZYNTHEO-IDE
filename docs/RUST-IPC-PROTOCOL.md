# Rust IPC Protocol (v1)

## Framing

**4-byte big-endian length + UTF-8 JSON body** on stdin/stdout.

**Why not bare JSON Lines?** Length-prefix lets the peer reject oversized frames *before* allocating/parsing unbounded lines (`max_message_bytes`, default 8 MiB).

**stdout:** protocol messages only.  
**stderr:** diagnostics / startup logs only.

## Request envelope

```json
{
  "protocol_version": 1,
  "id": "42",
  "op": "list_tree",
  "payload": { "root": "/path", "max_depth": 8, "max_files": 1000 }
}
```

## Response envelope

```json
{
  "protocol_version": 1,
  "id": "42",
  "ok": true,
  "result": { "root": "/path", "entries": ["a/", "a/b.txt"], "truncated": false }
}
```

Error:

```json
{
  "protocol_version": 1,
  "id": "42",
  "ok": false,
  "error": { "code": "LIMIT_EXCEEDED", "message": "…" }
}
```

## Operations

| op | payload | result |
|----|---------|--------|
| `ping` / `health` | `{}` | `{ service, api_version, protocol_version, pid }` |
| `list_tree` | `{ root, max_depth?, max_files? }` | `{ root, entries, truncated }` |
| `list_files` | `{ root, max_files? }` | file paths only |
| `build_index` | `{ root, max_depth?, max_files? }` | index snapshot |
| `refresh_index` | `{ root }` | snapshot + `rebuilt` |
| `cancel` | `{ target_id }` | `{ cancelled }` |
| `shutdown` | `{}` | `{ bye: true }` then exit |

## Error codes

`CANCELLED` · `LIMIT_EXCEEDED` · `PROTOCOL` · `IO` · `VERSION_MISMATCH` · `NOT_FOUND` · `TIMEOUT` · `UNAVAILABLE` · `INTERNAL`

## Client requirements

- Correlate by `id` (concurrent-safe buffer demux).
- Per-request timeout (`ZYNTHEO_RUST_TIMEOUT_MS`, default 30000).
- On `VERSION_MISMATCH`, disable Rust for the session.
- Restart budget (max 3) — no infinite respawn.
- Never treat stderr as protocol.

## Forbidden

- Arbitrary shell / eval ops.
- Unbounded message buffering without length checks.
