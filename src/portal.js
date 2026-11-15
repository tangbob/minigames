const grid = document.getElementById("grid");
const errBox = document.getElementById("err");
const P = window.MINIGAMES || { kind: "web", label: "🌐 网页版", shellVersion: "" };

document.getElementById("badge-platform").textContent = P.shellVersion
  ? `${P.label} · 壳 ${P.shellVersion}`
  : P.label;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function card(g) {
  const a = el("a", "card");
  a.href = g.href;
  a.appendChild(el("div", "emoji", g.emoji));
  a.appendChild(el("h2", null, g.name));
  a.appendChild(el("div", "en", g.en));
  a.appendChild(el("p", null, g.desc));
  if (g.tags && g.tags.length) {
    const tags = el("div", "tags");
    for (const t of g.tags) tags.appendChild(el("span", "tag", t));
    a.appendChild(tags);
  }
  a.appendChild(el("span", "play", "▶ 进入游玩"));
  return a;
}

function comingSoon() {
  const d = el("div", "card soon");
  d.appendChild(el("div", "emoji", "➕"));
  d.appendChild(el("h2", null, "下一个小游戏"));
  d.appendChild(el("div", "en", "COMING SOON"));
  d.appendChild(el("p", null, "把新游戏放进 games/<名字>/ 并附 game.json，重新构建后这里会自动出现新卡片。"));
  d.appendChild(el("span", "play", "📖 见 docs/新增小游戏.md"));
  return d;
}

async function loadGames() {
  const res = await fetch("games-index.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`games-index.json 回 ${res.status}`);
  const data = await res.json();
  const games = Array.isArray(data.games) ? data.games : [];
  if (!games.length) throw new Error("games/ 里还没有可玩的游戏");
  for (const g of games) grid.appendChild(card(g));
}

async function loadVersion() {
  const badge = document.getElementById("badge-version");
  try {
    const v = await (await fetch("version.json", { cache: "no-cache" })).json();
    badge.textContent = `🏷️ 前端 ${v.web}`;
    badge.title = `构建于 ${v.built}`;
  } catch {
    badge.textContent = "🏷️ 前端 dev（未构建）";
  }
}

// PWA: 手机/PC 浏览器可把合集装到桌面，离线也能开（壳内不提示，避免与原生安装混淆）。
let deferredPrompt = null;
const installBtn = document.getElementById("btn-install");
if (P.kind === "web") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove("hidden");
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => installBtn.classList.add("hidden"));
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[sw] 注册失败", e));
  }
}

loadVersion();
loadGames()
  .catch((e) => {
    errBox.textContent = `游戏列表读取失败：${e.message}。先跑 npm run build（清单由构建生成）。`;
  })
  .finally(() => grid.appendChild(comingSoon()));

// 下载按钮读同源清单（publish:android / publish:pc 写的）。OSS 没开 CORS，不能直接读桶。
const mb = (n) => ((Number(n) || 0) / 1048576).toFixed(1) + " MB";
async function loadDownloads() {
  const row = document.getElementById("dl-row");
  const items = [];
  try {
    const pc = await (await fetch("latest-pc.json", { cache: "no-cache" })).json();
    const url = pc.installer?.url || pc.exe?.url;
    const size = pc.installer?.size || pc.exe?.size;
    if (url) items.push({ label: "🖥️ PC 版 · Windows", sub: `安装包 ${mb(size)}`, href: url });
  } catch { /* 还没发过 PC */ }
  try {
    const and = await (await fetch("latest-android.json", { cache: "no-cache" })).json();
    if (and.url) items.push({ label: "📱 安卓版", sub: `v${and.version} · ${mb(and.size)}`, href: and.url });
  } catch { /* 还没发过安卓 */ }
  if (!items.length) return;
  for (const it of items) {
    const a = el("a", "dl-btn");
    a.href = it.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.appendChild(el("b", null, it.label));
    a.appendChild(el("span", null, it.sub));
    row.appendChild(a);
  }
  document.getElementById("downloads").classList.remove("hidden");
}
loadDownloads();