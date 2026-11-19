# Zyntheo IDE

**Intelligence in Every Line.**

Zyntheo IDE is an AI-first desktop code editor. It is independently maintained under [bimacoding/ZYNTHEO-IDE](https://github.com/bimacoding/ZYNTHEO-IDE) and no longer depends on Void remotes, binaries, or builder repositories.

## Heritage and licensing

Zyntheo started from Void IDE (Apache-2.0 product additions by Glass Devtools, Inc.) and is now independently maintained. Void itself was a fork of [Visual Studio Code](https://github.com/microsoft/vscode) (MIT). Historical source attribution is retained in the license files; runtime and packaging no longer depend on Void repositories.

Required notices are retained in:

- [`LICENSE.txt`](LICENSE.txt) — Apache 2.0 (product additions)
- [`LICENSE-VS-Code.txt`](LICENSE-VS-Code.txt) — MIT (VS Code)
- [`ThirdPartyNotices.txt`](ThirdPartyNotices.txt)

## Features

- AI chat and agent workflows with configurable model providers
- Fast Apply / Slow Apply code edits with reviewable diffs
- Autocomplete (FIM), Ctrl+K quick edit, Ctrl+L chat
- Full VS Code-compatible editor, extensions, terminal, git, and debug
- Cursor-style agent: Rules, Skills, Subagents, Hooks, MCP, and multi-agent chat tabs

## Linux

Cara jalankan paket rilis (AppImage, `.deb`, `.rpm`, tarball portable): [`docs/LINUX-INSTALL.md`](docs/LINUX-INSTALL.md).

## Agent

Cara kerja Rules / Skills / Subagents / Hooks / MCP: [`docs/AGENT-GUIDE.md`](docs/AGENT-GUIDE.md).

## Develop

See [`HOW_TO_CONTRIBUTE.md`](HOW_TO_CONTRIBUTE.md) and [`docs/ZYNTHEO-OVERVIEW.md`](docs/ZYNTHEO-OVERVIEW.md).

```bash
# Node 20.18.2 recommended (.nvmrc)
npm install
npm run buildreact
npm run watch
./scripts/code.sh   # macOS/Linux
```

## Documentation

Architecture, rebrand map, Rust plan, and compliance docs live under [`docs/`](docs/).

## Support

- Issues: https://github.com/bimacoding/ZYNTHEO-IDE/issues
