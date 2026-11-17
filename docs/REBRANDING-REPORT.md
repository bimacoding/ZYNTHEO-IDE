# Rebranding Report

**Status:** IMPLEMENTED (semantic rebrand) — full app compile VERIFICATION deferred (no `node_modules` in workspace at implement time)

## Changes applied

| Area | Result |
|------|--------|
| `product.json` | Zyntheo identity, new GUIDs, `zyntheo://`, `.zyntheo-editor`, `com.zyntheo.ide` |
| `contrib/void` → `contrib/zyntheo` | Folder + file renames |
| Types / services | `Void*` → `Zyntheo*`, `IVoid*` → `IZyntheo*` |
| IPC | `zyntheo-channel-*` |
| Action IDs | `zyntheo.*` + `legacyCommandAliases.ts` for `void.*` |
| Storage keys | `zyntheo.*` with Void read-fallback |
| Desktop / AppImage | `scripts/appimage/zyntheo*.desktop` |
| About dialog | Zyntheo Version |
| README / docs | Zyntheo product docs |
| Remote extensions publisher URLs | retargeted toward bimacoding/ZYNTHEO-IDE |

## Intentionally unchanged

- `src/vs/**` upstream namespaces
- `VSCODE_*` env vars, `vscode://` schemes
- `package.json` name `code-oss-dev`
- License grant texts; notices retained
- Language keyword `void`

## Known residual mentions of "Void"

Historical comments, migration source paths, and heritage docs may still mention Void by design.

## Pre-push amend review

- Fixed syntax regression `..Void` → `...config` in terminal tool service
- Completed AppImage packaging rebrand (`create_appimage.sh`, desktop entries, icon copy)
- Added `release` field alongside `zyntheoRelease` for metrics compatibility
