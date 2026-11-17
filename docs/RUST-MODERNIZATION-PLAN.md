# Rust Modernization Plan

**Status:** APPROVED architecture — Hybrid (Option E)  
**Workspace path:** `rust/zyntheo-workspace/`

## Comparison (decision record)

| Option | RAM/CPU | Extensions | Build complexity | Verdict |
|--------|---------|------------|------------------|---------|
| A Rust-native desktop | Best potential | Breaks vscode API | Very high | Reject |
| B Rust core + old UI unclear boundary | Unclear | Risk | High | Reject |
| C IPC services only, skip rebrand | Good later | Safe | Medium | Too early alone |
| D In-process native addon only | Limited | Safer | High (N-API) | Defer |
| **E Hybrid gradual** | Measurable gains | Preserved | Medium | **Select** |

## Crates (justified)

| Crate | Responsibility | Justification |
|-------|----------------|---------------|
| `zyntheo-core` | Errors, limits, cancel tokens, identity | Shared foundation |
| `zyntheo-ipc` | Length-prefixed JSON protocol, max message size | Safe Electron↔Rust boundary |
| `zyntheo-fs` | Bounded workspace tree / directory string | Hot path in `directoryStrService` |
| `zyntheo-index` | Incremental index + bounded cache | Only after baseline shows need |
| `zyntheo-sidecar` | Binary entrypoint for sidecar process | Process lifecycle |

## Non-goals (phase 1)

- Do not rewrite Monaco, extension host, or React chat UI in Rust
- Do not replace Electron
- Do not touch Microsoft `cli/code-cli` beyond coexistence

## Integration contract

1. Feature flag: `zyntheo.rustServices.enabled` (default off until tested)
2. Sidecar spawn from Electron main
3. On failure → fallback to TypeScript implementation
4. Cancellation + hard limits on walk depth, file count, message bytes
5. Unit tests + clippy + rustfmt; no unjustified `unsafe`

## Success metrics

- Document before/after RSS for directory context on large repos
- No extension regression
- Sidecar can be killed without crashing the IDE
