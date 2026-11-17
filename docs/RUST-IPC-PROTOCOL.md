# Rust IPC Protocol (v1)

## Framing

**4-byte big-endian length + UTF-8 JSON body** on stdin/stdout.

**Why not bare JSON Lines?** Length-prefix lets the peer reject oversized frames *before* allocating/parsing the body (`max_message_bytes`, default 8 MiB).

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
| `list_files` | `{ root, max_files? }` | `{ root, entries, truncated, cache_hit }` (deduped via index) |
| `build_index` | `{ root, max_depth?, max_files? }` | index snapshot |
| `refresh_index` | `{ root }` | snapshot + `rebuilt` |
| `watch_start` | `{ root, debounce_ms? }` | `{ watch_id }` |
| `watch_poll` | `{ watch_id, max_events? }` | `{ events: [{path, kind}], truncated }` |
| `watch_stop` | `{ watch_id }` | `{ stopped }` |
| `search` | `{ root, query, literal?, case_sensitive?, max_matches?, max_files?, max_file_bytes? }` | `{ matches, files_scanned, truncated }` |
| `stat_paths` | `{ root?, paths, max_paths? }` | `{ entries: [{path,is_dir,size,mtime_epoch_secs}], truncated }` |
| `resource_stats` | `{}` | `{ rss_bytes?, jobs_active, jobs_max, index_cached_roots, index_entries, watches, pid }` |
| `cancel` | `{ target_id }` | `{ cancelled }` |
| `shutdown` | `{}` | `{ bye: true }` then exit |

Watch events are **poll-drained** (no unsolicited stdout frames) so request/response demux stays safe.

## Error codes

`CANCELLED` · `LIMIT_EXCEEDED` · `PROTOCOL` · `IO` · `VERSION_MISMATCH` · `NOT_FOUND` · `TIMEOUT` · `UNAVAILABLE` · `INTERNAL`

## Client requirements

- Correlate by `id` (concurrent-safe buffer demux).
- Per-request timeout (`ZYNTHEO_RUST_TIMEOUT_MS`, default 30000).
- On `VERSION_MISMATCH`, disable Rust for the session.
- Optional adaptive disable: `ZYNTHEO_RUST_MAX_RSS_BYTES` or repeated `LIMIT_EXCEEDED` → mode `adaptive_disabled`.
- Restart budget (max 3) — no infinite respawn.
- Never treat stderr as protocol.

## Forbidden

- Arbitrary shell / eval ops.
- Unbounded message buffering without length checks.
