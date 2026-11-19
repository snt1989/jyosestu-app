// 通知を受け取り、圏外でもアプリを開けるように画面のファイルを控えておくサービスワーカー。
// いつも先にネットワークから最新を取り、つながらないときだけ控えを使います(データ本体は Firestore 側が端末に保存)。
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
var SHELL = "josetsu-shell-v1";
function shellOk(u) {
  if (u.origin === self.location.origin) return u.pathname.indexOf("/api/") !== 0 && u.pathname !== "/version.json";
  return u.hostname === "www.gstatic.com" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var u; try { u = new URL(req.url); } catch (err) { return; }
  if (!shellOk(u)) return;
  var nav = req.mode === "navigate";
  e.respondWith(caches.open(SHELL).then(function (cache) {
    var key = nav ? "/" : req;
    var hit = function () { return cache.match(key).then(function (r) { if (r) return r; throw new Error("offline"); }); };
    var net = fetch(req).then(function (r) {
      if (r && (r.ok || r.type === "opaque")) cache.put(key, r.clone());
      return r;
    });
    // 電波が弱くて5秒たっても返らないときは、控えがあればそれを出す
    var slow = new Promise(function (res) { setTimeout(res, 5000); }).then(function () {
      return cache.match(key).then(function (r) { return r || net; });
    });
    return Promise.race([net, slow]).catch(hit);
  }));
});

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  var title = d.title || "除雪管理アプリ";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "/" }
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.location.origin) === 0 && "focus" in c) {
        c.postMessage({ type: "nav", url: url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
