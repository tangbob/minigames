// 三端发布共用口径: 阿里云 OSS 签名 PUT/GET/DELETE/列表 + 密钥读取。
// 密钥读取顺序与同舟/凡梦一致: 仓内 .env → 进程环境 → 当前用户注册表 (HKCU\Environment)。
// 铁律: 只碰 minigames/ 前缀, 绝不写别的项目的对象; 任何地方都不打印密钥。
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

export const ROOT = join(import.meta.dirname, "..");
const ENV = loadEnv(join(ROOT, ".env"));

function loadEnv(p) {
  const out = {};
  if (!existsSync(p)) return out;
  for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function userEnv(name) {
  if (process.platform !== "win32") return "";
  try {
    const out = execSync(`reg query "HKCU\\Environment" /v ${name}`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    const m = out.match(new RegExp(name + "\\s+REG_\\w+\\s+(.+)"));
    return m ? m[1].trim() : "";
  } catch { return ""; }
}

export const pick = (k) => String(ENV[k] || process.env[k] || userEnv(k) || "").trim();

// 前缀正源只有这一处: 仓内 .env 的 OSS_PREFIX 覆盖，默认 sdxcloud/minigames（与同舟 sdxcloud/<项目>/ 同口径）
export const PREFIX = (pick("OSS_PREFIX") || "sdxcloud/minigames").replace(/\/+$/, "");
export const BUCKET = pick("OSS_BUCKET");
export const REGION = pick("OSS_REGION") || "oss-cn-hangzhou";
const AK_ID = pick("OSS_AK_ID");
const AK_SECRET = pick("OSS_AK_SECRET");
export const HOST = `https://${BUCKET}.${REGION}.aliyuncs.com`;
export const PUBLIC_BASE = (pick("OSS_PUBLIC_BASE") || HOST).replace(/\/+$/, "");

export function requireCreds() {
  if (!BUCKET || !AK_ID || !AK_SECRET) {
    throw new Error("缺 OSS_BUCKET / OSS_AK_ID / OSS_AK_SECRET（仓内 .env、进程环境或当前用户注册表任一处给齐即可）");
  }
}

function sign(verb, key, contentType = "") {
  const expires = Math.floor(Date.now() / 1000) + 600;
  const canon = `${verb}\n\n${contentType}\n${expires}\n/${BUCKET}/${key}`;
  const sig = crypto.createHmac("sha1", AK_SECRET).update(canon).digest("base64");
  return { expires, sig };
}

// latest 那类会被覆盖，给 no-cache 让换包当天生效；带版本号/哈希的内容不变，可长缓存
export async function ossPut(key, body, contentType, cache = "no-cache") {
  const s = sign("PUT", key, contentType);
  const r = await fetch(`${HOST}/${key}?OSSAccessKeyId=${AK_ID}&Expires=${s.expires}&Signature=${encodeURIComponent(s.sig)}`, {
    method: "PUT", headers: { "Content-Type": contentType, "Cache-Control": cache }, body,
  });
  if (!r.ok) throw new Error(`PUT ${key} 回 ${r.status}`);
}

export async function ossGet(key) {
  const s = sign("GET", key);
  const r = await fetch(`${HOST}/${key}?OSSAccessKeyId=${AK_ID}&Expires=${s.expires}&Signature=${encodeURIComponent(s.sig)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${key} 回 ${r.status}`);
  return r;
}

export async function ossGetJson(key) {
  const r = await ossGet(key);
  if (!r) return null;
  try { return JSON.parse(await r.text()); } catch { return null; }
}

export async function ossDelete(key) {
  const s = sign("DELETE", key);
  const r = await fetch(`${HOST}/${key}?OSSAccessKeyId=${AK_ID}&Expires=${s.expires}&Signature=${encodeURIComponent(s.sig)}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE ${key} 回 ${r.status}`);
  return r.status;
}

export function readRootVersion() {
  const v = String(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error(`根 package.json 的 version 不是三段数: ${v || "(空)"}`);
  return v;
}

export function sha256File(path) {
  return crypto.createHash("sha256").update(readFileSync(path)).digest("hex");
}