# Feature Compatibility

**Status:** IN_PROGRESS (source-level preservation) — runtime VERIFICATION deferred

## Preserved by design

- Monaco editor stack and `vscode` extension API
- AI chat/agent/providers/Apply/autocomplete under `contrib/zyntheo`
- Legacy `void.*` command aliases
- Storage read-fallback from Void keys
- Non-destructive Void user-data migration

## Risks until compile/smoke

- React UI must be rebuilt (`npm run buildreact`) after path renames
- Sidecar disabled by default — no runtime dependency on Rust for AI features
