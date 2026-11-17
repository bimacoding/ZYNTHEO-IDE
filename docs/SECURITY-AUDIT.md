# Security Audit (initial)

**Status:** IN_PROGRESS — initial review of Void/Zyntheo source surface

## Strengths to preserve

- LLM calls from Electron main (avoids renderer CSP/network issues)
- Secrets should stay out of renderer logs
- Extension transfer blacklists conflicting AI extensions
- Workspace trust model inherited from VS Code

## Risks / review areas

| Area | Risk | Mitigation |
|------|------|------------|
| API keys in settings storage | Exposure via logs/backups | Never log secret fields; migrate storage carefully |
| Agent file/terminal tools | Unbounded workspace writes | Keep review/approval UX; respect workspace boundaries |
| IPC channels | Spoofing if mis-bound | Keep channels on mainProcessElectronServer only |
| Update URL retarget | Supply-chain | Point only at bimacoding-controlled releases when ready |
| Sidecar Rust process | Command injection via paths | Pass paths as structured JSON; no shell |
| Secret scan before push | Accidental tokens | Run scan; exclude `.env`, credentials |

## Dependency audits

- Run `npm audit` when `node_modules` installed (record in SECURITY-REPORT)
- Run `cargo audit` on `rust/zyntheo-workspace` after scaffold

## Secrets policy

- No GitHub tokens in source or docs
- No force-push credentials
- Migration logs must redact API keys
