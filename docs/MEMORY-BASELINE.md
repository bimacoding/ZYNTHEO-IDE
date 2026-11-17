# Memory Baseline Plan

**Status:** NOT_STARTED (measurements) — plan VERIFIED

## Principle

Never invent benchmark numbers. Record process-level RSS/CPU only under documented conditions.

## Scenarios to measure

| ID | Scenario | Notes |
|----|----------|-------|
| M1 | Cold startup to idle workbench | No folder open |
| M2 | Idle with medium workspace | ~1k–5k files |
| M3 | Large repository open | e.g. this monorepo |
| M4 | AI chat session | Streaming response |
| M5 | AI agent with tools | File edits + terminal |
| M6 | Directory/context collection | Triggers fs walk |
| M7 | Long-running session 30+ min | Watch for leaks |

## Tools

- macOS: `ps -o rss,pid,command -p <pid>`, Activity Monitor sampling
- Linux: `/proc/<pid>/status` VmRSS
- Windows: Task Manager / `Get-Process` WS
- Optional: Electron `--inspect` + heap snapshots for renderer only

## Recording template

```
Date:
Commit:
Platform:
Scenario ID:
App RSS (MB):
Renderer RSS if available:
CPU % (idle / active):
Notes:
```

## Baseline (Void pre-rebrand)

**NOT MEASURED YET** — fill after first local run of packaged or `./scripts/code.sh`.

## After Rust fs/index

Compare same scenario IDs only. Mark status `VERIFIED` only with attached numbers.
