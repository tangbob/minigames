// 发壳前递增版本号。用法: node tools/bump-shell-version.mjs "这次改了什么"
//
// 它改三处, 三处必须一致(少一处客户端就认不出自己是哪一版):
//   1. shell-version.json        唯一事实源 code/name/note
//   2. android/variables.gradle  给 build.gradle 的 versionCode/versionName
//   3. capacitor.config.json     壳往 UA 里塞的 MinigamesShell/<version>, public/platform.js 靠它识别端
// 改完必须再跑 npx cap sync android, 否则装进包的 assets 里还是旧配置(同舟 1107 实踩)。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const note = process.argv.slice(2).join(" ").trim();

const vPath = join(ROOT, "shell-version.json");
const v = JSON.parse(readFileSync(vPath, "utf8"));
const prevCode = Number(v.code) || 1;
const prevName = String(v.name || "0.1.0");

// name 只升次位: 0.2.0 → 0.3.0
const parts = prevName.split(".").map((x) => parseInt(x, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[1] += 1;
parts[2] = 0;

const code = prevCode + 1;
const name = parts.join(".");

writeFileSync(vPath, JSON.stringify({ code, name, note }, null, 2) + "\n");
console.log(`shell-version.json   code ${prevCode} → ${code}, name ${prevName} → ${name}`);

const gPath = join(ROOT, "android", "variables.gradle");
if (existsSync(gPath)) {
  let g = readFileSync(gPath, "utf8");
  g = g.replace(
    /\/\/ BEGIN SHELL VERSION[\s\S]*?\/\/ END SHELL VERSION/,
    `// BEGIN SHELL VERSION (由 bump-shell-version.mjs 维护, 勿手改)\n    shellVersionCode = ${code}\n    shellVersionName = '${name}'\n    // END SHELL VERSION`
  );
  writeFileSync(gPath, g);
  console.log(`variables.gradle     shellVersionCode=${code} shellVersionName='${name}'`);
} else {
  console.warn(`缺 ${gPath}, 先跑 npx cap add android`);
}

const cPath = join(ROOT, "capacitor.config.json");
const cfg = JSON.parse(readFileSync(cPath, "utf8"));
cfg.android = cfg.android || {};
const before = cfg.android.appendUserAgent || "";
cfg.android.appendUserAgent = /MinigamesShell\/[0-9A-Za-z._+-]+/.test(before)
  ? before.replace(/MinigamesShell\/[0-9A-Za-z._+-]+/, `MinigamesShell/${name}`)
  : `MinigamesShell/${name}`;
writeFileSync(cPath, JSON.stringify(cfg, null, 2) + "\n");
console.log(`capacitor.config.json appendUserAgent: ${before} → ${cfg.android.appendUserAgent}`);

console.log(`\n下一步: npx cap sync android && cd android && gradlew assembleDebug`);
console.log(`然后:   node tools/publish-android.mjs —— 上传后线上 version_code=${code}`);