# Repository Audit — Zyntheo IDE (from Void)

**Status:** VERIFIED against source on 2026-11-17  
**Foundation:** Void IDE (fork of Microsoft VS Code 1.99.3)  
**Destination:** https://github.com/bimacoding/ZYNTHEO-IDE.git

## Summary

| Item | Value |
|------|-------|
| Base VS Code version (`package.json`) | 1.99.3 |
| Void product version (`product.json` voidVersion) | 1.4.9 |
| Void release (`voidRelease`) | 0044 |
| Desktop runtime | Electron 34.3.2 |
| Package manager | npm (yarn rejected by `build/npm/preinstall.js`) |
| Task runner | gulp |
| Node | 20.18.2 (`.nvmrc`) |
| Owned AI/UI code | `src/vs/workbench/contrib/void/` (~100 files, ~32k LOC) |
| Existing Rust | `cli/code-cli`, `build/win32/inno_updater` (upstream Microsoft) |

## Git

- Remote `origin`: `https://github.com/bimacoding/ZYNTHEO-IDE.git`
- Branch: `main`
- Migration strategy: new source snapshot (history of upstream Void need not be preserved)
- Legal: retain Apache 2.0 (Void additions) + MIT (VS Code) notices

## Build System

- Dev: `./scripts/code.sh` / `code.bat`
- Compile: `npm run compile` → gulp
- Void React UI: `npm run buildreact` / `watchreact` under `contrib/void/browser/react/`
- Release packaging historically via external `voideditor/void-builder` (not in this repo)
- CI in-repo: only `.github/workflows/triage.yml` (issue triage), no package/sign pipeline

## Product Identity (pre-rebrand)

See [ORIGINAL-VOID-IDENTIFIERS.md](ORIGINAL-VOID-IDENTIFIERS.md).

## Gaps Found Before Implementation

- No prior `docs/` audit set
- No Zyntheo string in source
- `product.json` `licenseName: MIT` does not fully reflect dual Apache-2.0 + MIT licensing
- No `updateUrl` for VS Code update service; Void used GitHub `voideditor/binaries`

## Verification Commands Used

```bash
# product identity
head -n 50 product.json
# void contrib size
find src/vs/workbench/contrib/void -type f | wc -l
# remotes
git remote -v
```
