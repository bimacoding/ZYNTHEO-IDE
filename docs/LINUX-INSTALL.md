# Zyntheo IDE 1.5.1 — Linux GUI

Panduan mandiri untuk mengunduh, memasang, dan menjalankan Zyntheo IDE di desktop Linux (GNOME, KDE Plasma, XFCE, Cinnamon, MATE, LXQt, Sway, Hyprland).

Rilis: https://github.com/bimacoding/ZYNTHEO-IDE/releases/tag/1.5.1

Aplikasi memakai Wayland native jika tersedia, lalu fallback ke X11/XWayland (`ELECTRON_OZONE_PLATFORM_HINT=auto`). Launcher mengikuti Freedesktop (`.desktop`, ikon hicolor, MIME, URL `zyntheo://`).

## 1. Pilih paket

| Distro / cara | Arsitektur | Berkas |
|---|---|---|
| Semua distro (tanpa install) | x86_64 | `Zyntheo-1.5.1-x86_64.AppImage` |
| Debian, Ubuntu, Linux Mint, Pop!_OS, elementary | amd64 / arm64 | `zyntheo_1.5.1_amd64.deb` / `zyntheo_1.5.1_arm64.deb` |
| Fedora, RHEL, CentOS, Rocky, AlmaLinux, openSUSE | x86_64 / aarch64 | `zyntheo-1.5.1.x86_64.rpm` / `zyntheo-1.5.1.aarch64.rpm` |
| Portable (tanpa root) | x64 / arm64 | `Zyntheo-linux-x64-1.5.1.tar.gz` / `Zyntheo-linux-arm64-1.5.1.tar.gz` |

Checksum: unduh berkas `.sha256` di samping paket, lalu:

```bash
sha256sum -c Zyntheo-1.5.1-x86_64.AppImage.sha256
```

## 2. AppImage (semua distro)

```bash
chmod +x Zyntheo-1.5.1-x86_64.AppImage
./Zyntheo-1.5.1-x86_64.AppImage
```

FUSE 2 diperlukan (`libfuse2` di Debian/Ubuntu, `fuse` di Fedora/Arch). Jika FUSE tidak ada:

```bash
./Zyntheo-1.5.1-x86_64.AppImage --appimage-extract
./squashfs-root/AppRun
```

## 3. Debian / Ubuntu / Linux Mint / Pop!_OS / elementary

```bash
sudo apt install ./zyntheo_1.5.1_amd64.deb
# ARM64: sudo apt install ./zyntheo_1.5.1_arm64.deb
# alternatif: sudo dpkg -i zyntheo_1.5.1_amd64.deb && sudo apt-get install -f
zyntheo
```

Paket mendaftarkan `/usr/share/applications/zyntheo.desktop`, ikon 512×512, MIME, dan handler `zyntheo://`.

## 4. Fedora / RHEL / CentOS / Rocky / AlmaLinux / openSUSE

```bash
sudo dnf install ./zyntheo-1.5.1.x86_64.rpm    # Fedora / RHEL 8+
# ARM: sudo dnf install ./zyntheo-1.5.1.aarch64.rpm
# openSUSE: sudo zypper install ./zyntheo-1.5.1.x86_64.rpm
# cadangan: sudo rpm -i zyntheo-1.5.1.x86_64.rpm
zyntheo
```

## 5. Tarball portable (tanpa root)

```bash
tar -xzf Zyntheo-linux-x64-1.5.1.tar.gz
./bin/zyntheo
```

Integrasi desktop opsional (per pengguna):

```bash
mkdir -p ~/.local/share/applications ~/.local/share/icons/hicolor/512x512/apps
# salin zyntheo.desktop dari paket, lalu:
update-desktop-database ~/.local/share/applications
```

## 6. Setelah terpasang

- Cari **Zyntheo** di launcher desktop, atau jalankan `zyntheo` di terminal.
- Chat agent: `Ctrl+L` (Linux/Windows) / `Cmd+L` (jika keymap macOS).
- Rules, Skills, Subagents, Hooks, MCP: lihat [AGENT-GUIDE.md](AGENT-GUIDE.md).
- Wiki mandiri: berkas ini dan [AGENT-GUIDE.md](AGENT-GUIDE.md) cukup untuk instalasi Linux dan penggunaan agent tanpa bantuan maintainer.
