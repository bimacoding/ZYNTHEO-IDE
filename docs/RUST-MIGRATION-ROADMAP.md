# Rust-First Migration Roadmap

**Target shape**

- **UI:** Electron + TypeScript (Monaco, workbench, React AI UI)
- **Performance core:** Rust sidecar services
- **Compatibility:** VS Code extension host preserved

Do **not** migrate editor UI or extension host just to raise Rust LOC %.

## Phase 0 — Foundation (DONE)

- Protocol v1 envelopes, health, shutdown, cancel
- FS list_tree / list_files with excludes
- Index cache + stale refresh
- TS client fallback modes A–H (+ `adaptive_disabled`)
- Channel wiring + optional `getAllURIsInDirectory` Rust path

## Phase 1 — Make P1 real for AI context (DONE)

1. ASCII `directoryStr` stays TypeScript; Rust for bulk URI/index.
2. Native file watcher — `zyntheo-watch` + `watch_*` IPC (poll model).
3. Package staging — `.build/` + `resources/helpers/` + gulp embed when binary present.
4. Integration tests — watch/search/stat/respawn/resource_stats.
5. Measured list_files compare — process-level (see `RUST-PERFORMANCE-BENCHMARKS.md`).

## Phase 2 — Search & context (DONE)

1. Bounded `search` IPC (literal/regex, caps, no shell).
2. `stat_paths` metadata batch.
3. Dedupe scanning — `list_files` reuses index (`cache_hit`).
4. Wire `search` into AI tools — `search_for_files` / `search_pathnames_only` when flagged.

## Phase 3 — Scheduler & monitoring (DONE)

1. Bounded background jobs — `JobGate` on heavy ops (`max_concurrency` default 2).
2. Resource sampling — `resource_stats` IPC (RSS, jobs, index, watches).
3. Adaptive disable — TS client: `ZYNTHEO_RUST_MAX_RSS_BYTES` and repeated `LIMIT_EXCEEDED` → mode `adaptive_disabled`, TS fallback kept.

## Exit criteria for “Rust is primary performance engine”

- Supported hot paths default to Rust when healthy.
- TS fallback still works with flag off.
- Documented benchmarks show improvement **or** justify keeping TS for that path.
- No extension/API regressions.

**Verification:** `npm run verify-zyntheo-rust` (ALL_PASS).

## Non-goals

- Rewrite Electron in Rust
- Replace Monaco
- Move extension host into Rust
