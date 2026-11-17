# Architecture — Zyntheo IDE

**Status:** VERIFIED from Void sources + VOID_CODEBASE_GUIDE.md

## Process Model

Zyntheo (like Void/VS Code) is an Electron application:

- **Main process** (`electron-main/`): Node APIs, native modules, LLM network I/O, update checks, MCP, metrics
- **Renderer / browser process**: Workbench UI, Monaco editor, React-mounted AI panels
- **Extension host**: Separate process for VS Code extensions (must remain compatible)

## Owned Layer (AI / product)

Primary owned code lives under `src/vs/workbench/contrib/void/` (to be renamed `contrib/zyntheo/`):

| Area | Role |
|------|------|
| `browser/` | Sidebar chat, Ctrl+K/L, autocomplete, settings UI, Apply/diff, tools, React |
| `common/` | Settings, model capabilities, prompts, storage keys, LLM types, MCP types |
| `electron-main/` | LLM send, update checker, SCM helpers, MCP host |

IPC channels (pre-rebrand): `void-channel-metrics`, `void-channel-update`, `void-channel-llmMessage`, `void-channel-scm`, `void-channel-mcp`.

## Unowned / Upstream Layer

- Monaco editor, workbench shell, terminal, git, search, debug, extension API (`vscode-dts`)
- Namespace `src/vs/**` (except owned contrib)
- Env vars `VSCODE_*`, schemes `vscode://`, `vscode-file://`, `vscode-webview://`

## Target Hybrid Rust Architecture (approved)

```
User → Electron Workbench → Monaco/Extensions
                         → Zyntheo AI UI (TS/React)
                         → Zyntheo IPC → Rust sidecar services
```

Rust owns performance-critical services first (filesystem context, bounded indexing). Editor and extension host stay on the existing stack.

See [RUST-MODERNIZATION-PLAN.md](RUST-MODERNIZATION-PLAN.md).
