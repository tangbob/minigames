// PC 安装包分发: 把 npx tauri build 的 exe 与 NSIS 安装包传到 OSS `sdxcloud/minigames/pc/`，
// 写 manifest.json 供下载页/对照使用。用法: npm run publish:pc
// 说明: 目前是「下载安装」而不是应用内 OTA —— 壳内自更新留到后面（见 docs/发布与更新规范.md）。
import crypto from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PREFIX, PUBLIC_BASE, ossPut, requireCreds, ROOT } from "./oss-publish-lib.mjs";

const PC_DIR = `${PREFIX}/pc`;
const REL = join(ROOT, "src-tauri", "target", "release");

// 构建号来自 build.rs 写进 OUT_DIR 的 mg-build-stamp.txt；取最新一份。
function buildStamp() {
  const base = join(REL, "build");
  if (!existsSync(base)) return "";
  let best = { t: 0, v: "" };
  for (const d of readdirSync(base)) {
    const p = join(base, d, "out", "mg-build-stamp.txt");
    try {
      const t = statSync(p).mtimeMs;
      if (t > best.t) best = { t, v: readFileSync(p, "utf8").trim() };
    } catch { /* 不是我们的包 */ }
  }
  // build.rs 每次编译都会重算, 但增量编译时旧的 out 目录还在 —— 取最新的那份。
  return best.v;
}

async function main() {
  requireCreds();
  const exe = join(REL, "minigames.exe");
  if (!existsSync(exe)) throw new Error(`没找到 ${exe}，先 npx tauri build`);
  const nsisDir = join(REL, "bundle", "nsis");
  const installer = existsSync(nsisDir)
    ? readdirSync(nsisDir).filter((f) => f.endsWith(".exe")).map((f) => join(nsisDir, f))[0]
    : "";
  const stamp = buildStamp();
  if (!stamp) console.warn("  警告: 读不到构建号, manifest.version 将为空（不影响文件分发）");

  const exeBuf = readFileSync(exe);
  const exeSha = crypto.createHash("sha256").update(exeBuf).digest("hex");
  console.log(`[1/3] 上传 exe ${(exeBuf.length / 1048576).toFixed(1)} MB → ${PC_DIR}/MINIGAMES.exe`);
  await ossPut(`${PC_DIR}/MINIGAMES.exe`, exeBuf, "application/octet-stream", "no-cache");

  let installerInfo = null;
  if (installer) {
    const buf = readFileSync(installer);
    const name = installer.split(/[\\/]/).pop();
    console.log(`[2/3] 上传安装包 ${name} (${(buf.length / 1048576).toFixed(1)} MB)`);
    await ossPut(`${PC_DIR}/${name}`, buf, "application/octet-stream", "no-cache");
    installerInfo = {
      file: `${PC_DIR}/${name}`,
      url: `${PUBLIC_BASE}/${PC_DIR}/${encodeURIComponent(name)}`,
      size: buf.length,
      sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    };
  } else {
    console.log("[2/3] 没找到 NSIS 安装包，只发免安装 exe");
  }

  const manifest = {
    version: stamp,
    updated_at: new Date().toISOString(),
    exe: { file: `${PC_DIR}/MINIGAMES.exe`, url: `${PUBLIC_BASE}/${PC_DIR}/MINIGAMES.exe`, size: exeBuf.length, sha256: exeSha },
    installer: installerInfo,
  };
  console.log(`[3/3] 写 ${PC_DIR}/manifest.json (version=${stamp || "?"})`);
  await ossPut(`${PC_DIR}/manifest.json`, JSON.stringify(manifest, null, 2), "application/json", "no-cache");

  // 同源副本给门户的「下载 PC 版」按钮用（OSS 没开 CORS，浏览器不能直接读桶）。
  const infoBuf = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  if (existsSync(join(ROOT, "dist"))) writeFileSync(join(ROOT, "dist", "latest-pc.json"), infoBuf);
  const persist = join(ROOT, "release", "pc", "latest-pc.json");
  mkdirSync(join(ROOT, "release", "pc"), { recursive: true });
  writeFileSync(persist, infoBuf);

  console.log(`OK ${JSON.stringify({ version: stamp, exe: manifest.exe.url, installer: installerInfo?.url || null })}`);
}

main().catch((e) => { console.error("publish:pc 失败:", e.message); process.exit(1); });