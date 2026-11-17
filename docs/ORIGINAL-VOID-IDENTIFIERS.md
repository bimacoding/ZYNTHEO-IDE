# Original Void Identifiers (pre-rebrand snapshot)

**Status:** VERIFIED from `product.json` and source — do not treat as current after rebrand.

## product.json

| Field | Value |
|-------|-------|
| nameShort | Void |
| nameLong | Void |
| voidVersion | 1.4.9 |
| voidRelease | 0044 |
| applicationName | void |
| dataFolderName | .void-editor |
| serverApplicationName | void-server |
| serverDataFolderName | .void-server |
| tunnelApplicationName | void-tunnel |
| urlProtocol | void |
| darwinBundleIdentifier | com.voideditor.code |
| linuxIconName | void-editor |
| win32MutexName | voideditor |
| win32DirName | Void |
| win32NameVersion | Void |
| win32RegValueName | VoidEditor |
| win32AppUserModelId | Void.Editor |
| win32ShellNameShort | V&oid |
| win32x64AppId | {9D394D01-1728-45A7-B997-A6C82C5452C3} |
| win32arm64AppId | {0668DD58-2BDE-4101-8CDA-40252DF8875D} |
| win32x64UserAppId | {8BED5DC1-6C55-46E6-9FE6-18F7E6F7C7F1} |
| win32arm64UserAppId | {F6C87466-BC82-4A8F-B0FF-18CA366BA4D8} |
| reportIssueUrl | https://github.com/voideditor/void/issues/new |
| licenseUrl | https://github.com/voideditor/void/blob/main/LICENSE.txt |

## User data paths

| Platform | User data | Extensions folder |
|----------|-----------|-------------------|
| macOS | `~/Library/Application Support/Void` | `~/.void-editor` |
| Linux | `~/.config/Void` | `~/.void-editor` |
| Windows | `%APPDATA%\Void` | `%USERPROFILE%\.void-editor` |

## IPC channels

- `void-channel-metrics`
- `void-channel-update`
- `void-channel-llmMessage`
- `void-channel-scm`
- `void-channel-mcp`

## Storage keys

- `void.settingsServiceStorageII`
- `void.chatThreadStorageII`
- `void.app.optOutAll`

## Action IDs (sample)

- `void.ctrlLAction`, `void.ctrlKAction`, `void.acceptDiff`, `void.rejectDiff`, …
- `void.sidebar.open`, `void.cmdShiftL`, `void.historyAction`, `void.settingsAction`

## URLs / orgs

- voideditor.com, voideditor.dev
- github.com/voideditor/void, voideditor/binaries, voideditor/void-builder
- OpenRouter HTTP-Referer: https://voideditor.com

## Copyright

- Void additions: Copyright 2025 Glass Devtools, Inc. (Apache 2.0)
- VS Code: Microsoft Corporation (MIT)
