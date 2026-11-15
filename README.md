# MINIGAMES · 小游戏合集

一份 web 前端 + PC（Tauri）/ 安卓（Capacitor）薄壳。合集首页自动扫描 `games/` 目录生成卡片，新游戏放进去就能玩。

- 线上：<https://minigames.zhinengtai.xyz>
- 本机：`http://127.0.0.1:8770/`（双击 `启动游戏.bat`）

## 快速开始

```bash
npm install
npm run build          # 构建 dist/
npm run serve          # 127.0.0.1:8770 现发
# 或开发模式
npm run dev            # http://localhost:5370
```

## 目录

```
index.html            门户入口（Vite）
src/                  门户样式与逻辑
games/<名字>/         每个小游戏一个静态目录（原样拷进 dist）
  └ game.json         卡片元数据
public/               platform.js / manifest / sw.js / offline.html / icons
tools/                games-index / serve-web / verify / publish-* / bump-shell-version
server/               restart-web-win.ps1 + run_hidden.vbs（无窗口拉起 8770）
docs/                 三端与子域名 / 发布与更新规范 / 新增小游戏
src-tauri/            PC 壳（Tauri 2）
android/              安卓壳（Capacitor 8）
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | Vite 开发服（5370） |
| `npm run build` | 构建 `dist/`（含 `games/` 与 `games-index.json`） |
| `npm run serve` | 在 8770 现发 `dist/` |
| `npm run verify` | 提交闸门：构建 + 临时实例探活 |
| `npm run publish:web` | 整版归档到 OSS |
| `npm run publish:android` / `publish:pc` | 分发 APK / exe |
| `npm run bump:shell "说明"` | 升壳版本（三处一起改） |

## 文档

- [三端与子域名](docs/多端与子域名.md)
- [发布与更新规范](docs/发布与更新规范.md)
- [新增小游戏](docs/新增小游戏.md)
