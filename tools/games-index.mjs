// 扫描 games/<名字>/ 生成合集清单。构建产物、开发服、verify 三处都走这一个函数，
// 避免「本地有卡片线上没有」这类口径分裂。
// 用法: node tools/games-index.mjs [games目录] [输出json]
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";

export function scanGames(gamesDir) {
  if (!existsSync(gamesDir)) return [];
  const out = [];
  for (const dir of readdirSync(gamesDir).sort()) {
    if (dir.startsWith(".")) continue;
    const base = join(gamesDir, dir);
    if (!statSync(base).isDirectory()) continue;
    let meta = {};
    const metaPath = join(base, "game.json");
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf8"));
      } catch (e) {
        console.warn(`[games-index] ${dir}/game.json 解析失败，按目录名兜底: ${e.message}`);
      }
    } else {
      console.warn(`[games-index] ${dir}/ 缺 game.json，按目录名兜底`);
    }
    const entry = String(meta.entry || "index.html").replace(/^\/+/, "");
    if (!existsSync(join(base, entry))) {
      console.warn(`[games-index] ${dir}/ 的入口 ${entry} 不存在，跳过`);
      continue;
    }
    out.push({
      dir,
      entry,
      href: `games/${dir}/${entry}`,
      name: String(meta.name || dir),
      en: String(meta.en || ""),
      emoji: String(meta.emoji || "🎮"),
      desc: String(meta.desc || ""),
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
    });
  }
  return out;
}

export function writeIndex(gamesDir, outFile) {
  const games = scanGames(gamesDir);
  writeFileSync(outFile, JSON.stringify({ games }, null, 2) + "\n");
  return games;
}

if (process.argv[1] && extname(process.argv[1]) === ".mjs" && /games-index\.mjs$/.test(process.argv[1])) {
  const gamesDir = process.argv[2] || join(process.cwd(), "games");
  const outFile = process.argv[3];
  const games = outFile ? writeIndex(gamesDir, outFile) : scanGames(gamesDir);
  for (const g of games) console.log(`${g.emoji} ${g.name} (${g.en}) → ${g.href}`);
  console.log(`共 ${games.length} 个游戏${outFile ? `，已写 ${outFile}` : ""}`);
}