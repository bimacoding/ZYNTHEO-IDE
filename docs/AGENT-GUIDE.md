# Zyntheo Agent — Rules, Skills, Subagents, Hooks, MCP

Cara kerja agent Zyntheo meniru Cursor: folder proyek `.zyntheo/` (setara `.cursor/`) dibaca otomatis dan dimasukkan ke prompt chat. Folder `.cursor/` lama tetap didukung sebagai sumber legacy.

## Struktur folder

```
.zyntheo/
  rules/                 # aturan proyek (selalu / glob / deskripsi)
  skills/<name>/SKILL.md # skill yang di-expand jika relevan
  agents/                # subagent custom (Markdown + YAML frontmatter)
  hooks.json             # hook event (sebelum/sesudah tool, prompt, stop)
  mcp.json               # MCP server workspace (digabung dengan user MCP)

~/.zyntheo/
  rules/
  skills/
  agents/
  hooks.json
```

File akar yang juga dibaca sebagai rules: `.zyntheorules`, `.cursorrules`, `AGENTS.md`, `RULE.md`, `rules.md`.

## Rules

Contoh `.zyntheo/rules/project.mdc`:

```markdown
---
description: Project-wide coding standards
alwaysApply: true
---

Keep functions small. Prefer existing patterns.
```

Rule dengan `globs` hanya aktif jika file terbuka cocok. Rule dengan `description` (tanpa glob) aktif jika kueri pengguna relevan.

## Skills

Contoh `.zyntheo/skills/commit-helper/SKILL.md`:

```markdown
---
name: commit-helper
description: Generate conventional commit messages from git diffs.
---

1. Inspect the staged diff.
2. Write a conventional commit message.
```

Katalog skill selalu dikirim ke model. Isi skill di-expand jika nama/deskripsi cocok dengan kueri, atau jika pengguna menyebut skill secara eksplisit (`/commit-helper`). `disable-model-invocation: true` membuat skill hanya dimuat jika disebut.

## Subagents

File `.zyntheo/agents/<name>.md` mendefinisikan subagent seperti Cursor:

```markdown
---
name: explorer
description: Read-only explorer. Use to inspect the codebase without editing.
readonly: true
---

Stay scoped. Prefer search/read tools. Summarize findings for the parent agent.
```

Built-in:

| Nama | Mode | Kegunaan |
|---|---|---|
| `explore` | Ask (read-only) | Telusuri kode, jawab tanpa edit |
| `plan` | Plan | Rancang pendekatan |
| `debug` | Debug | Diagnosis lalu perbaikan kecil |
| `generalPurpose` | Agent | Tugas implementasi penuh |

Parent agent memanggil tool `spawn_subagent`. Zyntheo membuka tab chat baru (label subagent). Klik tab untuk melihat progres. Hasil ringkas dikembalikan ke parent.

## Hooks

File `.zyntheo/hooks.json` (workspace mengalahkan user):

```json
{
  "version": 1,
  "hooks": {
    "beforeSubmitPrompt": [
      { "command": "python3 .zyntheo/hooks/before-prompt.py" }
    ],
    "preToolUse": [
      { "command": "python3 .zyntheo/hooks/pre-tool.py", "matcher": "edit_file|rewrite_file" }
    ],
    "postToolUse": [
      { "command": "python3 .zyntheo/hooks/post-tool.py" }
    ],
    "stop": [
      { "command": "python3 .zyntheo/hooks/stop.py" }
    ]
  }
}
```

Event: `beforeSubmitPrompt`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `stop`.

Hook menerima JSON di stdin (`event`, `threadId`, `toolName`, `command`, ...). Exit code `2` atau JSON `{"permission":"deny"}` membatalkan tool. `{"permission":"allow"}` atau exit `0` meneruskan.

## MCP

Dua sumber, digabung (workspace menang jika nama server sama):

1. User: `~/<dataFolder>/mcp.json` (dibuka dari Settings → MCP)
2. Workspace: `.zyntheo/mcp.json` atau `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

Tool MCP muncul di agent/debug/multitask (mode tulis). Mode Plan/Ask tetap read-only.

## Chat tabs (seperti Cursor)

- Tab di bawah header CHAT meniru Cursor: chat terbaru berjajar, tab aktif lebih terang dengan tombol close, tab lain redup.
- **+** di header CHAT atau `Ctrl/Cmd+Shift+L` = New Agent (thread kosong, tab baru).
- Close (`×`) mengarsipkan chat, **bukan** menghapus. Buka lagi dari ikon jam (history).
- Subagent yang di-spawn otomatis muncul sebagai tab. Parent menunggu ringkasan child, lalu kartu hasil bisa diklik untuk membuka tab itu.

## Composer (seperti Cursor)

- `/` membuka skill + perintah mode (`/agent`, `/plan`, `/ask`, `/debug`, `/multitask`) dan perintah built-in (`/review`, `/create-rule`, `/create-skill`, `/create-subagent`, `/create-hook`).
- `Shift+Tab` mengganti mode.
- Saat agent berjalan, **Enter** mengantri pesan berikutnya (FIFO). **Cmd/Ctrl+Enter** menaruh pesan di depan antrian (kirim berikutnya). Antrian bisa di-reorder atau dihapus. **Stop** / Escape membatalkan.
- Mode Plan punya tombol **Build**. Setelah selesai, follow-up chip muncul di bawah transcript.
- `@` menambahkan file/folder ke konteks.
