// 安卓包发布: 固定 key 放「永远最新」的包 + 写 latest.json。
// 用法:
//   npm run publish:android                 # 用已打好的包 (release 优先, 没有就用 debug)
//   npm run publish:android -- --apk <路径>  # 指定包
// 密钥口径与 publish-web 相同。
import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PREFIX, PUBLIC_BASE, HOST, ossPut, ossGetJson, requireCreds, ROOT } from "./oss-publish-lib.mjs";

const APP_DIR = `${PREFIX}/app`;
const APK_KEY = `${APP_DIR}/minigames-android-latest.apk`;
const INFO_KEY = `${APP_DIR}/latest.json`;

async function main() {
  requireCreds();
  const argv = process.argv.slice(2);
  const argApk = argv.includes("--apk") ? argv[argv.indexOf("--apk") + 1] : "";
  const candidates = argApk
    ? [argApk]
    : [
        join(ROOT, "android/app/build/outputs/apk/release/app-release.apk"),
        join(ROOT, "android/app/build/outputs/apk/debug/app-debug.apk"),
      ];
  const apk = candidates.find((p) => p && existsSync(p));
  if (!apk) throw new Error("没找到 APK：先 cd android && gradlew assembleDebug，或用 --apk 指定");

  const shellMeta = JSON.parse(readFileSync(join(ROOT, "shell-version.json"), "utf8"));
  const name = String(shellMeta.name);
  const code = Number(shellMeta.code) || 1;

  // 防「忘了 cap sync」: 打进包里的 assets 配置才是客户端真读到的 UA。
  // 它和 shell-version.json 不一致 → 装上后客户端认不出自己是最新版(同舟 1107 实踩)。
  const packedCfgPath = join(ROOT, "android/app/src/main/assets/capacitor.config.json");
  if (!existsSync(packedCfgPath)) throw new Error(`缺 ${packedCfgPath}, 先 npx cap sync android`);
  const packed = JSON.parse(readFileSync(packedCfgPath, "utf8"));
  const packedUa = String(packed?.android?.appendUserAgent || "");
  if (packedUa !== `MinigamesShell/${name}`) {
    console.error(`✗ 包内 UA 是「${packedUa}」, shell-version.json 是 MinigamesShell/${name}`);
    console.error(`  先 npx cap sync android 再重新打包。`);
    process.exit(1);
  }

  // 线上那份不许比本次新同名不同版(防止忘升版本号)。
  const prev = await ossGetJson(INFO_KEY);
  if (prev && Number(prev.version_code) >= code && prev.version !== name) {
    console.error(`✗ 线上是 code=${prev.version_code}(${prev.version}), 这次是 code=${code}(${name})`);
    console.error(`  先 node tools/bump-shell-version.mjs "改了什么" 再重打。`);
    process.exit(1);
  }

  const buf = readFileSync(apk);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  console.log(`[1/3] 上传 ${apk} (${(buf.length / 1048576).toFixed(1)} MB) → ${APK_KEY}`);
  await ossPut(APK_KEY, buf, "application/vnd.android.package-archive", "no-cache");

  const info = {
    version: name,
    version_code: code,
    size: buf.length,
    sha256,
    note: String(shellMeta.note || ""),
    ...(shellMeta.must ? { must: true } : {}),
    updated_at: new Date().toISOString(),
    file: APK_KEY,
    url: `${PUBLIC_BASE}/${APK_KEY}`,
  };
  const infoBuf = Buffer.from(JSON.stringify(info, null, 2), "utf8");
  console.log(`[2/3] 写 ${INFO_KEY}`);
  await ossPut(INFO_KEY, infoBuf, "application/json", "no-cache");

  // 同源副本: 8770 现发 dist/，客户端不受 OSS CORS 限制；dist 会被 build 清空，
  // 所以另存一份 release/android/ 持久副本，vite 构建时还原（见 vite.config.js）。
  const localCopy = join(ROOT, "dist/latest-android.json");
  if (existsSync(join(ROOT, "dist"))) writeFileSync(localCopy, infoBuf);
  const persist = join(ROOT, "release", "android", "latest-android.json");
  mkdirSync(join(ROOT, "release", "android"), { recursive: true });
  writeFileSync(persist, infoBuf);
  console.log(`[3/3] 同源副本 dist/latest-android.json + 持久副本 release/android/`);

  console.log(`OK ${JSON.stringify({ version: name, version_code: code, size: buf.length })}`);
  console.log(`下载: ${info.url}`);
  console.log(`自检: curl -s ${HOST}/${INFO_KEY}`);
}

main().catch((e) => { console.error("publish:android 失败:", e.message); process.exit(1); });