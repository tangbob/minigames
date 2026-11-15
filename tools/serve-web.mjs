// 本机现发前端: 把 dist/ 发在 127.0.0.1:8770。PC 壳开机探这个口, 探到就吃这份最新的 UI;
// Cloudflare 隧道 minigames.zhinengtai.xyz 也回源到这里, 所以这里的响应头就是用户拿到的头。
// 用法: npm run serve (先 npm run build)。改前端 → build → 重启本服务, 壳重开即最新。
// 端口与 src-tauri 的 LOCAL_BASES[0]、子域名路由三处对应, 改一起改。
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { join, extname, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.env.MINIGAMES_SERVE_PORT || 8770);

// 无控制台运行(WMI/vbs 拉起)时 stdout 可能不可写; 日志落文件, 排障看 logs/serve-web.log。
const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "logs");
mkdirSync(LOG_DIR, { recursive: true });
const LOG = join(LOG_DIR, "serve-web.log");
function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  try { appendFileSync(LOG, line + "\n"); } catch { /* 日志写不进不影响服务 */ }
  try { console.log(line); } catch { /* 无控制台 */ }
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
};

// 带内容哈希的文件名(Vite 产物)永久缓存; 没哈希的给一天; 入口 HTML 与清单必须每次校验。
const HASHED = /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i;
function cacheFor(file) {
  const base = file.split(/[\\/]/).pop() || "";
  if (base.endsWith(".html") || base === "games-index.json" || base === "version.json" || base === "sw.js") return "no-cache";
  if (HASHED.test(base)) return "public, max-age=31536000, immutable";
  return "public, max-age=86400";
}

function send(res, code, body, type = "text/plain; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(body);
}

createServer(async (req, res) => {
  // 单条请求出错不能带走整个服务（Node 24 的未处理拒绝是致命的）。
  try {
    await handle(req, res);
  } catch (err) {
    log(`500 ${req.method} ${req.url} ${err && err.stack ? err.stack : err}`);
    try {
      if (!res.headersSent) res.writeHead(500).end("server error");
      else res.destroy();
    } catch { /* 连接已断 */ }
  }
}).listen(PORT, "127.0.0.1", () => {
  log(`minigames 前端现发: http://127.0.0.1:${PORT}/ (根目录 ${ROOT})`);
});

async function handle(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") {
    let web = "";
    try { web = JSON.parse(await readFile(join(ROOT, "version.json"), "utf8")).web; } catch { /* 未构建 */ }
    send(res, 200, JSON.stringify({ ok: true, project: "minigames", port: PORT, web }), "application/json");
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, "bad request");
    return;
  }
  let p = join(ROOT, pathname);
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html");
  } catch { /* 下面 stat 会给 404 */ }
  // 只发 ROOT 里的东西: 解码后的 ../ 不能把本机文件读出去。
  const rel = relative(ROOT, p);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    send(res, 403, "forbidden");
    return;
  }
  let st;
  try {
    st = await stat(p);
  } catch (err) {
    log(`404 ${req.method} ${url.pathname} (${err.code || err.message})`);
    send(res, 404, "not found");
    return;
  }
  if (!st.isFile()) {
    send(res, 404, "not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(p).toLowerCase()] || "application/octet-stream",
    "Cache-Control": cacheFor(p),
    "Access-Control-Allow-Origin": "*",
    "Content-Length": st.size,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(p);
  stream.on("error", (err) => {
    log(`stream error ${url.pathname} (${err.code || err.message})`);
    res.destroy();
  });
  stream.pipe(res);
}