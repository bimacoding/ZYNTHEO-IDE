# Feature Inventory

**Status:** VERIFIED from Void contrib + product surface

## Editor / IDE (upstream VS Code — retain)

- Editor tabs, Monaco, syntax highlighting
- Language features / IntelliSense / diagnostics / formatting
- Debugging, Terminal, Git, File explorer, Search
- Extensions, Themes, Keyboard shortcuts, User settings
- Workspace / multi-root

## AI Features (Void-owned — preserve + rebrand)

| Feature | Location (pre-rebrand) |
|---------|------------------------|
| Chat sidebar | `contrib/void/browser/react/src/sidebar-tsx/` |
| Quick edit (Ctrl+K) | `quick-edit-tsx/`, `quickEditActions.ts` |
| Chat focus (Ctrl+L) | `sidebarActions.ts`, `actionIDs.ts` |
| Autocomplete / FIM | `autocompleteService.ts` |
| Apply (fast search/replace + slow rewrite) | `editCodeService.ts` |
| Agent / tools | `toolsService.ts`, `terminalToolService.ts` |
| Settings / providers | `voidSettingsService.ts`, `void-settings-tsx/` |
| Onboarding | `void-onboarding/` |
| Model capabilities | `modelCapabilities.ts` |
| MCP | `mcpService.ts`, electron-main MCP |
| Update check | `voidUpdateMainService.ts` |
| Metrics | `metricsService.ts` |
| Extension transfer (VS Code/Cursor/Windsurf → Void) | `extensionTransferService.ts` |

## Providers

Configurable providers (do not remove silently): OpenAI-compatible, Anthropic, Google GenAI, Ollama, OpenRouter, and others listed in settings/modelCapabilities.

## Packaging / Desktop

- macOS bundle id, Windows AppIds, Linux desktop/AppImage scripts
- URL protocol `void://` (→ `zyntheo://`)
- Remote SSH/WSL extensions download REH from `bimacoding/ZYNTHEO-IDE` releases (`zyntheo-reh-*`)
