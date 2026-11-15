// 提交闸门: 构建 → 起一个临时现发实例 → 逐个探活门户/清单/每个游戏/图标/PWA → 退出。
// 用法: npm run verify
// 只用 node 内置能力（不依赖浏览器），CI 和本机都能跑；真机/浏览器的手动验收见 docs/发布与更新规范.md。
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const PORT = Number(process.env.MINIGAMES_VERIFY_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;

const results = [];
function ok(name, extra = "") { results.push({ name, pass: true, extra }); console.log(`  ✓ ${name}${extra ? "  " + extra : ""}`); }
function fail(name, why) { results.push({ name, pass: false }); console.error(`  ✗ ${name}  ${why}`); }

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], ...opts });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });
}

async function head(path) {
  const r = await fetch(BASE + path, { redirect: "manual" });
  return { status: r.status, type: r.headers.get("content-type") || "", cache: r.headers.get("cache-control") || "" };
}

async function main() {
  console.log("[1/3] 构建");
  // 直接跑 vite，不经 npm（避免 Windows 上 shell:true 的转义告警）
  const build = await run(process.execPath, [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "build"]);
  if (build.code !== 0) {
    console.error(build.out);
    throw new Error("vite build 失败");
  }
  const version = JSON.parse(readFileSync(join(ROOT, "dist", "version.json"), "utf8")).web;
  ok("vite build", `web=${version}`);

  const index = JSON.parse(readFileSync(join(ROOT, "dist", "games-index.json"), "utf8"));
  if (!Array.isArray(index.games) || index.games.length === 0) throw new Error("games-index.json 为空");
  for (const g of index.games) {
    if (!existsSync(join(ROOT, "dist", g.href))) throw new Error(`清单里的 ${g.href} 在 dist 里不存在`);
  }
  ok("games-index.json", `${index.games.length} 个游戏`);

  console.log("[2/3] 起临时现发实例");
  const server = spawn(process.execPath, [join(ROOT, "tools", "serve-web.mjs")], {
    cwd: ROOT, env: { ...process.env, MINIGAMES_SERVE_PORT: String(PORT) }, stdio: "ignore",
  });
  const deadline = Date.now() + 10000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + "/health");
      if (r.ok) { up = true; break; }
    } catch { /* 还没起 */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!up) { server.kill(); throw new Error(`临时实例 ${PORT} 起不来`); }
  ok("serve-web 启动", `:${PORT}`);

  console.log("[3/3] 探活");
  try {
    const home = await head("/");
    home.status === 200 ? ok("门户 /") : fail("门户 /", `HTTP ${home.status}`);
    if (home.cache !== "no-cache") fail("门户缓存头", home.cache);

    for (const g of index.games) {
      const h = await head("/" + g.href);
      h.status === 200 ? ok(`游戏 ${g.name}`, g.href) : fail(`游戏 ${g.name}`, `HTTP ${h.status}`);
    }

    for (const p of ["/version.json", "/games-index.json", "/manifest.webmanifest", "/sw.js", "/offline.html", "/platform.js", "/icons/icon-192.png", "/icons/icon.svg"]) {
      const h = await head(p);
      h.status === 200 ? ok(`静态 ${p}`) : fail(`静态 ${p}`, `HTTP ${h.status}`);
    }

    // 带哈希资源必须 immutable；入口 HTML 必须 no-cache
    const html = await (await fetch(BASE + "/")).text();
    const asset = (html.match(/\/assets\/[^"']+\.js/) || [])[0];
    if (asset) {
      const h = await head(asset);
      h.status === 200 && /immutable/.test(h.cache) ? ok("哈希资源 immutable", asset) : fail("哈希资源缓存头", `${h.status} ${h.cache}`);
    } else {
      fail("首页资源引用", "首页里找不到 /assets/*.js");
    }
  } finally {
    server.kill();
  }

  const bad = results.filter((r) => !r.pass);
  console.log(`\n${bad.length ? "✗ 失败" : "✓ 全绿"}  ${results.length - bad.length}/${results.length}`);
  if (bad.length) process.exit(1);
}

main().catch((e) => { console.error("verify 失败:", e.message); process.exit(1); });