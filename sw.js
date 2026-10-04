const CACHE_VERSION = "pindou-v1";

const CORE_ASSETS = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.webmanifest",
];

const OFFLINE_FALLBACK = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>拼豆工具 - 离线</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6f8;color:#18212b;
font-family:"Microsoft YaHei","PingFang SC","Segoe UI",ui-sans-serif,system-ui,sans-serif}
div{max-width:420px;margin:0 20px;padding:28px;background:#fff;border:1px solid #dce3e8;border-radius:12px;text-align:center}
h1{margin:0 0 10px;font-size:18px}p{margin:0;color:#687480;font-size:13px;line-height:1.6}
</style></head><body><div><h1>暂时无法离线打开</h1>
<p>请先在联网状态下打开一次本页面，资源缓存完成后即可断网使用。</p></div></body></html>`;

function precache() {
  return caches.open(CACHE_VERSION).then((cache) => {
    const failures = [];
    return Promise.all(
      CORE_ASSETS.map((url) =>
        fetch(new Request(url, { cache: "reload" }))
          .then((response) => {
            if (!response || !response.ok) {
              throw new Error("HTTP " + (response ? response.status : "无响应"));
            }
            return cache.put(url, response);
          })
          .catch((error) => {
            failures.push(url + " -> " + error.message);
          })
      )
    ).then(() => {
      if (failures.length) {
        console.warn("[sw] 以下资源预缓存失败：", failures);
      }
    });
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => {
        if (self.registration.navigationPreload) {
          return self.registration.navigationPreload.enable();
        }
        return undefined;
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function matchIndex(cache) {
  return cache.match("./index.html").then((cached) => cached || cache.match("./index.html", { ignoreSearch: true }));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) {
            await cache.put("./index.html", preloaded.clone());
            return preloaded;
          }
          const fresh = await fetch(request);
          if (fresh && fresh.ok) {
            await cache.put("./index.html", fresh.clone());
          }
          return fresh;
        } catch (error) {
          const cached = await matchIndex(cache);
          if (cached) return cached;
          return new Response(OFFLINE_FALLBACK, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(request, { ignoreSearch: true });

      if (cached) {
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (response && response.ok) return cache.put(request, response);
              return undefined;
            })
            .catch(() => undefined)
        );
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        return new Response("", { status: 504, statusText: "offline" });
      }
    })()
  );
});
