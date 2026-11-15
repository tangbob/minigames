// 把本次构建的整份 dist 归档到 OSS `minigames/web/<版本>/`，写 `minigames/web/latest.json`。
// 用法: npm run build && npm run publish:web
//
// 与同舟/凡梦的口径不同（这是有意的）:
//   那两家的页面是 SPA，首页由隧道现发、大件资源直读 OSS。合集不一样 —— games/ 里的游戏
//   用 importmap + 相对路径引 three，一旦把首页引用改写成跨域绝对地址，游戏内的相对模块解析就崩了。
//   所以这里**不改写 index.html**：线上页面（含所有游戏）由 8770 经 Cloudflare 隧道同源现发，
//   OSS 只做「整版归档（回滚/对照用）」+ 安卓/PC 安装包分发。
// 落点只在 minigames/ 前缀，绝不写别家。
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { PREFIX, PUBLIC_BASE, ossPut, requireCreds, ROOT } from "./oss-publish-lib.mjs";

const DIST = join(ROOT, "dist");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".woff2": "font/woff2", ".txt": "text/plain",
};
const ct = (f) => MIME[extname(f).toLowerCase()] || "application/octet-stream";

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push({ abs: p, rel: relative(base, p).replace(/\\/g, "/") });
  }
  return out;
}

async function main() {
  requireCreds();
  if (!existsSync(join(DIST, "index.html"))) throw new Error("没有 dist/index.html, 先 npm run build");
  if (!existsSync(join(DIST, "version.json"))) throw new Error("没有 dist/version.json, 构建不完整");
  const version = JSON.parse(readFileSync(join(DIST, "version.json"), "utf8")).web;
  const WEB_DIR = `${PREFIX}/web`;

  // 1) 整版归档（路径带构建版本，内容永不变 → immutable）
  const files = walk(DIST);
  for (const { abs, rel } of files) {
    await ossPut(`${WEB_DIR}/${version}/${rel}`, readFileSync(abs), ct(rel), "public, max-age=31536000, immutable");
  }
  console.log(`  归档 ${files.length} 个文件 → ${WEB_DIR}/${version}/`);

  // 2) latest.json: 指向本次归档，便于对照线上跑的是哪一版
  const latest = {
    web: version,
    built: new Date().toISOString(),
    fileCount: files.length,
    url: `${PUBLIC_BASE}/${WEB_DIR}/${version}/index.html`,
  };
  await ossPut(`${WEB_DIR}/latest.json`, JSON.stringify(latest, null, 2), "application/json", "no-cache");
  console.log(`  latest.json → ${PUBLIC_BASE}/${WEB_DIR}/latest.json`);

  console.log(`\n发布完成。线上页面仍由 8770 现发（含 games/），本次构建 web=${version}`);
  console.log(`检查: curl -s https://minigames.zhinengtai.xyz/version.json  应等于 ${version}`);
}

main().catch((e) => { console.error("publish:web 失败:", e.message); process.exit(1); });