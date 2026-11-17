# Rebranding Map — Void → Zyntheo

**Status:** IMPLEMENTATION GUIDE

## Product identity

| Void | Zyntheo |
|------|---------|
| Void | Zyntheo / Zyntheo IDE |
| void | zyntheo |
| void:// | zyntheo:// |
| .void-editor | .zyntheo-editor |
| .void-server | .zyntheo-server |
| com.voideditor.code | com.zyntheo.ide |
| Void.Editor | Zyntheo.IDE |
| void-editor | zyntheo-editor |
| voidVersion | zyntheoVersion |
| voidRelease | zyntheoRelease |
| voideditor (publisher/org URLs owned) | bimacoding / ZYNTHEO-IDE |

## New Windows GUIDs (generated 2026-11-17 — do not reuse Void GUIDs)

| Field | New GUID |
|-------|----------|
| win32x64AppId | {EAE3B2ED-8F58-4215-AE40-664374D50EAD} |
| win32arm64AppId | {2DB44F16-81BE-461D-9770-F98965D899C0} |
| win32x64UserAppId | {9D17965F-0987-4722-81E9-B643746A049B} |
| win32arm64UserAppId | {F1511F1B-7B77-4459-8D8C-7F0678832F6F} |

## Code paths

| Void | Zyntheo |
|------|---------|
| `src/vs/workbench/contrib/void/` | `src/vs/workbench/contrib/zyntheo/` |
| `void-channel-*` | `zyntheo-channel-*` |
| `void.*` action IDs | `zyntheo.*` (+ legacy aliases) |
| `void.*` storage keys | `zyntheo.*` (+ read fallback) |
| `--void-*` CSS | `--zyntheo-*` |
| Void* / IVoid* types | Zyntheo* / IZyntheo* |

## Do NOT replace

- `src/vs/` namespace (except owned contrib rename)
- `vscode://`, `vscode-file://`, `vscode-webview://`, `vscode-remote://`
- Env `VSCODE_*`
- `package.json` name `code-oss-dev`
- Language keyword `void`, Rust `c_void`
- Third-party package names and marketplace URLs (unless retargeting owned binaries)
- Microsoft copyright headers on upstream files
- Glass Devtools Apache headers may remain as historical copyright; product name strings change

## Compatibility requirements

- Register command aliases for old `void.*` action IDs
- Storage: read old keys if new keys empty; write new keys
- User data: migrate Void folders → Zyntheo without deleting Void
