# AGENTS.md — minigames 仓库约定

给接手这个仓库的人/AI：

## 这个仓库是什么

小游戏合集。**一份 web 前端（合集 + games/ 下的游戏）+ 两个薄壳**（PC: Tauri，安卓: Capacitor）。
线上入口 `https://minigames.zhinengtai.xyz`，经 Cloudflare 隧道回源本机 **8770**。

## 铁律

1. **端口**：8770 只归本仓。不占用/重启/杀别的项目端口（8092 同舟、8791 凡梦、8192 qpic、5191 盯盘、8091 回声、8080 平台 BFF、7682 g8）。
   杀进程只按自己记下的 PID，禁止按映像名/通配符杀。
2. **线上 OSS 只写 `sdxcloud/minigames/` 下发布 key**，绝不写测试/示例/假数据。
3. **改前端不重打壳**。只有壳的原生代码/配置/图标/权限变了才 `npx tauri build` 或重打 APK。
4. **`.ps1` 存成 UTF-8 with BOM**。Windows PowerShell 5.1 读无 BOM 的 UTF-8 会把中文注释解码坏，严重时把 `param(...)` 吞掉导致参数失效。
5. **`games/` 是即插即用静态目录**：不引入构建、不用绝对路径、不放 `node_modules`。入口清单由 `tools/games-index.mjs` 扫描生成。
6. **不要重写 `index.html` 里的资源引用到 OSS**。游戏用相对路径 + importmap，跨域绝对地址会崩；OSS 只做整版归档与安装包分发。

## 提交纪律

- commit 前缀 `[Q3]`，消息说明「为什么」。
- `git add` 逐个点名文件，不用 `git add -A`。
- 只推 `main`。
- 提交前跑 `npm run verify`；界面类改动还要真开浏览器点一遍（构建通过 ≠ 能玩）。

## 常用入口

| 要做的事 | 去哪 |
|---|---|
| 了解三端/子域名 | `docs/多端与子域名.md` |
| 发版/回滚 | `docs/发布与更新规范.md` |
| 加游戏 | `docs/新增小游戏.md` |
| 端识别 | `public/platform.js`（唯一入口） |
| 门户逻辑 | `src/portal.js` |
| 现发服务 | `tools/serve-web.mjs` |
| 重启现发 | `server/restart-web-win.ps1` |

## 当前明确未做

- 游戏触控操作（手机壳能打开，但 city-racer 目前只支持键盘）。
- PC 壳应用内 OTA。
- 安卓 release 签名。
