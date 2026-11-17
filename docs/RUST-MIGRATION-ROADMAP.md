# Rust-First Migration Roadmap

**Target shape**

- **UI:** Electron + TypeScript (Monaco, workbench, React AI UI)
- **Performance core:** Rust sidecar services
- **Compatibility:** VS Code extension host preserved

Do **not** migrate editor UI or extension host just to raise Rust LOC %.

## Phase 0 — Foundation (DONE / this pass)

- Protocol v1 envelopes, health, shutdown, cancel
- FS list_tree / list_files with excludes
- Index cache + stale refresh
- TS client fallback modes A–H
- Channel wiring + optional `getAllURIsInDirectory` Rust path

## Phase 1 — Make P1 real for AI context

1. Align Rust tree output with `directoryStrService` string contract **or** keep TS for strings and Rust for bulk URI/index only (prefer measurable win).
2. Native file watcher (`notify`) with debounce + ignore rules.
3. Package `zyntheo-sidecar` into desktop builds.
4. Integration tests: crash, timeout, missing binary, version mismatch.
5. First **measured** before/after on large repo URI listing.

## Phase 2 — Search & context

1. Ripgrep-class search behind IPC (allowlisted roots only).
2. Metadata batch APIs for context gathering.
3. Dedupe scanning between AI context and index.

## Phase 3 — Scheduler & monitoring

1. Bounded background jobs.
2. Resource sampling API for diagnostics panel.
3. Adaptive disable when host memory pressure is high.

## Exit criteria for “Rust is primary performance engine”

- Supported hot paths default to Rust when healthy.
- TS fallback still works with flag off.
- Documented benchmarks show improvement **or** justify keeping TS for that path.
- No extension/API regressions.

## Non-goals

- Rewrite Electron in Rust
- Replace Monaco
- Move extension host into Rust
