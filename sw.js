// 通知を受け取るためのサービスワーカー。画面やデータは保存(キャッシュ)しません。
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () { /* そのままネットワークへ */ });

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
