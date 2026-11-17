# Security Policy

## Reporting

Please report security issues via GitHub Security Advisories or by opening a private report against [bimacoding/ZYNTHEO-IDE](https://github.com/bimacoding/ZYNTHEO-IDE).

Do not file public issues that include secrets, API keys, or private customer data.

## Secrets

- Never commit `.env`, tokens, or private keys
- AI provider credentials must remain in encrypted application storage
- Logs must not print API keys

## Scope

Zyntheo inherits VS Code / Electron security properties (sandbox, workspace trust). Agent tools that edit files or run terminals require explicit user review flows preserved from the Void architecture.
