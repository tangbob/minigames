import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { scanGames } from "./tools/games-index.mjs";

const GAMES = path.join(process.cwd(), "games");
const DIST = path.join(process.cwd(), "dist");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff2": "font/woff2",
};

// games/ 是即插即用的静态目录: 原样拷进 dist，开发时原样发。
// 关键是别让 Vite 改写游戏里的 HTML/模块 —— 游戏用 importmap + 相对路径引 three，
// 一旦被开发服转成自己的口径，本地能跑线上就崩。
function gamesHub() {
  return {
    name: "mg-games-hub",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url === "/games-index.json") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(JSON.stringify({ games: scanGames(GAMES) }));
          return;
        }
        if (!url.startsWith("/games/")) return next();
        let rel;
        try {
          rel = decodeURIComponent(url.slice("/games/".length));
        } catch {
          res.statusCode = 400;
          res.end("bad request");
          return;
        }
        let p = path.join(GAMES, rel);
        const r = path.relative(GAMES, p);
        if (r.startsWith("..") || path.isAbsolute(r)) {
          res.statusCode = 403;
          res.end("forbidden");
          return;
        }
        try {
          if (fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
        } catch { /* 下面 readFile 会给出 404 */ }
        fs.readFile(p, (err, buf) => {
          if (err) {
            res.statusCode = 404;
            res.end("not found");
            return;
          }
          res.setHeader("Content-Type", MIME[path.extname(p).toLowerCase()] || "application/octet-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.end(buf);
        });
      });
    },
    closeBundle() {
      fs.rmSync(path.join(DIST, "games"), { recursive: true, force: true });
      if (fs.existsSync(GAMES)) fs.cpSync(GAMES, path.join(DIST, "games"), { recursive: true });
      const games = scanGames(GAMES);
      fs.writeFileSync(path.join(DIST, "games-index.json"), JSON.stringify({ games }, null, 2) + "\n");
      // vite build 会清空 dist，把 publish:android / publish:pc 写的同源清单一起冲掉。
      // 发布脚本在 release/ 留了持久副本，这里原样还原（照同舟 1107 实踩的教训）。
      for (const [file, persistDir] of [["latest-android.json", "android"], ["latest-pc.json", "pc"]]) {
        const inDist = path.join(DIST, file);
        const persist = path.join(process.cwd(), "release", persistDir, file);
        if (!fs.existsSync(inDist) && fs.existsSync(persist)) fs.copyFileSync(persist, inDist);
      }
      console.log(`[mg-games-hub] ${games.length} 个游戏 → dist/games/ + dist/games-index.json`);
    },
  };
}

// 前端版本 = 构建时间 + 入口 chunk 短哈希，写进 dist/version.json。
// 每次构建天然是新版本，不存在忘记递增；门户上直接显示，一眼分清「壳新还是前端新」。
function webVersion() {
  let stamp = "";
  return {
    name: "mg-web-version",
    apply: "build",
    buildStart() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${pad(d.getHours())}${pad(d.getMinutes())}`;
    },
    writeBundle(_opts, bundle) {
      const entry = Object.entries(bundle).find(([, it]) => it.type === "chunk" && it.isEntry);
      const hash = entry ? (entry[0].match(/index-([A-Za-z0-9_-]+)\.js/) || [])[1] || "" : "";
      const ver = `${stamp}.${hash}`;
      fs.writeFileSync(path.join(DIST, "version.json"), JSON.stringify({ web: ver, built: new Date().toISOString() }) + "\n");
      console.log(`[mg-web-version] ${ver} → dist/version.json`);
    },
  };
}

export default defineConfig({
  plugins: [gamesHub(), webVersion()],
  build: { target: "es2020", assetsInlineLimit: 4096 },
  server: { host: true, port: 5370, strictPort: true },
  preview: { host: true, port: 5371, strictPort: true },
});