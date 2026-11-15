// 合集的离线兜底: 带内容哈希的资源永久缓存，其余一律网络优先（保证改前端立刻生效），
// 断网时回落缓存，导航都没有缓存才给 offline.html。跨域(OSS)资源不接管，交给浏览器 HTTP 缓存。
const CACHE = "minigames-v1";
const OFFLINE = "/offline.html";
const HASHED = /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (HASHED.test(url.pathname)) {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") return (await cache.match(OFFLINE)) || Response.error();
      return Response.error();
    }
  })());
});