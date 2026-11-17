# Rust Migration Status

| Component | Status |
|-----------|--------|
| Architecture decision (Hybrid E) | VERIFIED |
| Long-term Rust performance core | ROADMAP (`docs/RUST-MIGRATION-ROADMAP.md`) |
| `zyntheo-core` | TESTED |
| `zyntheo-ipc` (protocol v1 envelopes) | TESTED |
| `zyntheo-fs` (list_tree / list_files) | TESTED |
| `zyntheo-index` (cache + mtime refresh) | TESTED |
| `zyntheo-sidecar` | IMPLEMENTED |
| Electron spawn bridge + fallback A–H | IMPLEMENTED |
| Main↔renderer channel `zyntheo-channel-rust` | IMPLEMENTED |
| Wire into `getAllURIsInDirectory` | PARTIAL (flagged) |
| Wire into directory ASCII string tree | DEFERRED (TS remains) |
| Native file watching | DEFERRED |
| Packaged sidecar in releases | NOT_STARTED |
| Memory before/after (app-level) | NOT_STARTED |

See also: `docs/RUST-SIDECAR-REVIEW.md`, `docs/RUST-SERVICE-INVENTORY.md`.
