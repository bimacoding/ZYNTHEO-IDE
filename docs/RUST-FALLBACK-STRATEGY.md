# Rust Fallback Strategy

TypeScript implementations are **never deleted**. Rust is opt-in.

## Modes (A–H)

| Mode | Trigger | Behavior |
|------|---------|----------|
| A Disabled | `ZYNTHEO_RUST_SERVICES` unset/≠1 | TS only |
| B Healthy | Flag on + health OK | Rust for supported ops |
| C Binary missing | Path not found | Permanent disable → TS |
| D Startup failure | Spawn/error | Record diagnostic → TS |
| E Operation failure | `ok:false` / exception | Op-level TS fallback |
| F Crash | Process exit mid-flight | Reject pending; next call may restart (budget) |
| G Version mismatch | `protocol_version` ≠ 1 | Permanent disable → TS |
| H Timeout | Exceeds `ZYNTHEO_RUST_TIMEOUT_MS` | Cancel best-effort → TS |

## Diagnostics

`getStatus()` returns `{ mode, reason?, code?, at }` without file contents or secrets.

Logged via `ILogService` at warn/trace — structured enough for support, not a telemetry dump of workspace trees.

## Caller contract

Methods return `undefined` on failure. Callers **must** keep TS path:

```ts
const rust = await rustService.listFiles(path, max);
if (rust?.entries?.length) { /* use */ }
// else TypeScript implementation
```

## Restart policy

- Max 3 restart attempts.
- Successful health handshake refunds one attempt.
- Exhausted budget → permanently disabled for the session.
