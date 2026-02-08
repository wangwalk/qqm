# qqm

QQ Music CLI / QQ 音乐命令行工具

Search, play, download, and manage your library — all from the terminal with structured JSON output for scripting and AI agent integration.

## Features

- Search tracks, albums, artists, playlists
- Playback via [mpv](https://mpv.io/) with IPC control (play/pause/stop/seek/volume/repeat)
- Track info, streaming URLs, lyrics, download
- Library management (liked tracks, recent history)
- Playlist browsing
- Browser cookie import from Chrome, Edge, Firefox, Safari via [sweet-cookie](https://github.com/steipete/sweet-cookie)
- Multi-profile support for multiple accounts
- Three output modes: colorized human-readable, JSON, plain text
- Debug/verbose logging (`-v`, `-d`)
- Cross-platform: macOS, Linux, Windows

## Why Cookies?

QQ Music has no public API. The unofficial API endpoints require valid session cookies. Instead of implementing a fragile login flow (QR code/SMS), qqm imports cookies directly from your browser:

- **Multi-browser** — Chrome, Edge, Firefox, Safari (auto-detected)
- **No credentials stored** — reads browser's encrypted cookie DB via OS keychain
- **No captcha** — skip SMS verification entirely
- **Always fresh** — re-run `auth login` anytime to refresh
- **One command** — `qqm auth login` and you're in

## Install / 安装

```bash
# npm
npx qqm search track "周杰伦"    # Run without installing / 免安装运行
npm install -g qqm               # Install globally / 全局安装

# pnpm
pnpm dlx qqm search track "周杰伦"
pnpm add -g qqm

# bun
bunx qqm search track "周杰伦"
bun add -g qqm
```

## Quick Start / 快速开始

```bash
qqm auth login                        # Import cookies from browser
qqm search track "晴天"               # Search
qqm track play 0039MnYb0qxYhV         # Play (requires mpv)
qqm player pause                      # Pause/resume
qqm player stop                       # Stop
```

## Commands / 命令

### auth

```bash
qqm auth login              # Import cookies from browser / 从浏览器导入 Cookie
qqm auth login --profile X  # Specify Chrome/Edge profile / 指定 Chrome/Edge Profile
qqm auth check              # Check login status / 检查登录状态
qqm auth logout             # Logout / 登出
```

### search

```bash
qqm search track <query>    # Search tracks / 搜索歌曲
qqm search album <query>    # Search albums / 搜索专辑
qqm search playlist <query> # Search playlists / 搜索歌单
qqm search artist <query>   # Search artists / 搜索歌手
```

Options: `-l, --limit <n>` (default 20), `-o, --offset <n>` (default 0)

### track

```bash
qqm track detail <mid>       # Track metadata / 歌曲详情
qqm track url <mid>          # Streaming URL / 播放链接
qqm track lyric <mid>        # Lyrics / 歌词
qqm track download <mid>     # Download / 下载
qqm track play <mid>         # Play via mpv / 用 mpv 播放
```

Options: `-q, --quality <level>` standard | high (default) | sq | flac | hires

### player

Requires [mpv](https://mpv.io/). / 需要安装 [mpv](https://mpv.io/)。

```bash
qqm player status           # Current playback status / 播放状态
qqm player pause            # Toggle pause/resume / 暂停或继续
qqm player stop             # Stop playback / 停止播放
qqm player seek <seconds>   # Seek relative (e.g. 10, -10) / 快进快退
qqm player seek 30 --absolute  # Seek to absolute position / 跳转到指定位置
qqm player volume [0-150]   # Get or set volume / 音量
qqm player repeat [on|off]  # Toggle or set repeat / 单曲循环
```

### library

```bash
qqm library liked           # Liked tracks / 喜欢的音乐
qqm library like <mid>      # Like a track / 收藏
qqm library unlike <mid>    # Unlike / 取消收藏
qqm library recent          # Recently played / 最近播放
```

### playlist

```bash
qqm playlist list           # My playlists / 我的歌单
qqm playlist detail <id>    # Playlist tracks / 歌单详情
```

## Global Options / 全局选项

| Flag | Description |
|------|-------------|
| `--json` | Force JSON output (default when piped) / 强制 JSON 输出 |
| `--plain` | Plain text output (tab-separated) / 纯文本输出 |
| `--pretty` | Pretty-print JSON / 格式化 JSON |
| `--quiet` | Suppress output / 静默模式 |
| `--no-color` | Disable colors / 禁用颜色 |
| `--profile <name>` | Account profile (default: "default") / 账号配置 |
| `-v, --verbose` | Verbose output / 详细输出 |
| `-d, --debug` | Debug output (implies --verbose) / 调试输出 |
| `--timeout <seconds>` | Request timeout (default: 30) / 请求超时秒数 |

## Output Modes / 输出模式

| Mode | When | Description |
|------|------|-------------|
| Human | TTY (default) | Colorized, readable / 彩色可读 |
| JSON | Piped or `--json` | Structured `{ success, data, error }` / 结构化 JSON |
| Plain | `--plain` | Tab-separated, scriptable / 制表符分隔 |

```bash
# Colorized output in terminal / 终端彩色输出
qqm search track "周杰伦"

# JSON for scripting / JSON 用于脚本
qqm --json search track "周杰伦"
qqm search track "周杰伦" | jq '.data.tracks[0]'

# Plain text for cut/awk / 纯文本用于文本处理
qqm --plain search track "周杰伦" | cut -f1,2
```

Exit codes: `0` success, `1` general error, `2` auth error, `3` network error.

## Multi-Profile / 多账号

```bash
qqm --profile work auth login    # Login with "work" profile
qqm --profile work library liked  # Use "work" profile
qqm auth login                    # Default profile
```

Profiles are stored in `~/.config/qqm/profiles/<name>/`.

## Requirements / 环境要求

- Node.js >= 24
- Chrome, Edge, Firefox, or Safari (for cookie import / 用于导入 Cookie)
- [mpv](https://mpv.io/) (optional, for playback / 可选，用于播放)
- macOS, Linux, or Windows

## Legal / 免责

This tool uses unofficial QQ Music API endpoints. Use responsibly and in accordance with Tencent's Terms of Service.

本工具使用非官方 QQ 音乐 API，请合理使用并遵守腾讯 QQ 音乐服务条款。

## License

MIT
