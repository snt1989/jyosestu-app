// 通知(Web Push)の登録と送信。
// 環境変数: FIREBASE_SERVICE_ACCOUNT(既存)/ VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(例 mailto:xxx@example.com)
const admin = require("firebase-admin");
const crypto = require("crypto");
const ADMINS = String(process.env.ADMIN_EMAILS || "admin@sanoh-ltd.jp").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const TYPES = ["note", "ann", "status", "report"];
const ST = { prep: "準備中", out: "出動中", done: "完了" };

function init() {
  if (admin.apps.length) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  return true;
}
function vapidReady() { return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY); }
let wp = null;
function webpush() {
  if (wp) return wp;
  wp = require("web-push");
  wp.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@sanoh-ltd.jp", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return wp;
}
const hid = (endpoint) => crypto.createHash("sha1").update(String(endpoint)).digest("hex");
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const fresh = (t, ms) => typeof t === "number" && Date.now() - t >= 0 && Date.now() - t < ms;

async function sendTo(subs, payload) {
  const body = JSON.stringify(payload);
  let sent = 0, gone = 0;
  await Promise.all(subs.map(async (d) => {
    const s = d.data();
    try {
      await webpush().sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { gone++; try { await d.ref.delete(); } catch (e2) {} }
    }
  }));
  return { sent, gone };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    if (!vapidReady()) return res.status(500).json({ error: "not_configured" });
    try { webpush(); } catch (e) { return res.status(500).json({ error: "bad_vapid" }); }
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  let ok;
  try { ok = init(); } catch (e) { return res.status(500).json({ error: "bad_service_account" }); }
  if (!ok || !vapidReady()) return res.status(500).json({ error: "not_configured" });
  try {
    const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!tok) return res.status(401).json({ error: "unauthorized" });
    const me = await admin.auth().verifyIdToken(tok);
    const fs = admin.firestore();
    const ud = await fs.doc("users/" + me.uid).get();
    const role = ud.exists ? ud.data().role : "";
    const isAdm = ADMINS.indexOf(String(me.email || "").toLowerCase()) >= 0 || role === "admin";
    if (!(isAdm || role === "member")) return res.status(403).json({ error: "forbidden" });
    const myName = (ud.exists && ud.data().name) || "";
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = String(b.action || "");

    if (action === "subscribe") {
      const s = b.sub || {};
      if (!s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth || String(s.endpoint).indexOf("https://") !== 0) return res.status(400).json({ error: "bad_sub" });
      const prefs = {};
      TYPES.forEach((t) => { prefs[t] = !(b.prefs && b.prefs[t] === false); });
      await fs.doc("pushSubs/" + hid(s.endpoint)).set({ uid: me.uid, endpoint: String(s.endpoint), keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) }, prefs, ua: clip(req.headers["user-agent"], 160), at: Date.now() });
      return res.status(200).json({ ok: true });
    }
    if (action === "unsubscribe" || action === "prefs") {
      const ref = fs.doc("pushSubs/" + hid(b.endpoint));
      const d = await ref.get();
      if (!d.exists || d.data().uid !== me.uid) return res.status(200).json({ ok: true });
      if (action === "unsubscribe") await ref.delete();
      else { const prefs = {}; TYPES.forEach((t) => { prefs[t] = !(b.prefs && b.prefs[t] === false); }); await ref.update({ prefs }); }
      return res.status(200).json({ ok: true });
    }
    if (action === "test") {
      const q = await fs.collection("pushSubs").where("uid", "==", me.uid).get();
      const r = await sendTo(q.docs, { title: "テスト通知", body: "この端末に通知が届いています。", tag: "test", url: "/" });
      return res.status(200).json({ ok: true, sent: r.sent });
    }
    if (action === "notify") {
      const type = String(b.type || ""), id = String(b.id || "");
      if (TYPES.indexOf(type) < 0 || !id || id.indexOf("/") >= 0) return res.status(400).json({ error: "bad_request" });
      let payload = null, key = "";
      if (type === "note") {
        const d = await fs.doc("notes/" + id).get(); const n = d.exists ? d.data() : null;
        if (!n || n.by !== me.uid || !fresh(n.at, 600000)) return res.status(200).json({ ok: true, skipped: true });
        key = "note_" + id;
        payload = { title: "連絡: " + (n.siteId ? (n.siteName || "現場") : "全体"), body: clip((myName ? myName + ": " : "") + n.text, 100), tag: "note", url: "/?go=notes" };
      } else if (type === "ann") {
        const d = await fs.doc("announcements/" + id).get(); const a = d.exists ? d.data() : null;
        if (!a || a.by !== me.uid || !isAdm || !fresh(a.at, 600000)) return res.status(200).json({ ok: true, skipped: true });
        key = "ann_" + id;
        payload = { title: (a.important ? "【重要】" : "お知らせ: ") + clip(a.title, 40), body: clip(a.body, 100), tag: "ann", url: "/" };
      } else if (type === "report") {
        const d = await fs.doc("reports/" + id).get(); const r = d.exists ? d.data() : null;
        if (!r || r.by !== me.uid || !fresh(r.at, 600000)) return res.status(200).json({ ok: true, skipped: true });
        key = "report_" + id;
        payload = { title: "日報: " + (r.siteName || "現場"), body: clip([r.crew, r.snowCm !== "" && r.snowCm != null ? "積雪 " + r.snowCm + "cm" : "", myName && !r.crew ? myName : ""].filter(Boolean).join(" ・ ") || "日報が提出されました", 100), tag: "report", url: "/?go=reports" };
      } else {
        const d = await fs.doc("ops/" + id).get(); const o = d.exists ? d.data() : null;
        if (!o || !ST[o.status] || !fresh(o.statusAt, 120000)) return res.status(200).json({ ok: true, skipped: true });
        const sd = await fs.doc("sites/" + id).get();
        key = "status_" + id + "_" + o.statusAt;
        payload = { title: ST[o.status] + ": " + (sd.exists ? sd.data().name : "現場"), body: clip((o.statusBy || myName || "") + (sd.exists && sd.data().crew ? "(担当 " + sd.data().crew + ")" : ""), 100) || "作業状況が更新されました", tag: "status_" + id, url: "/?site=" + encodeURIComponent(id) };
      }
      try { await fs.doc("pushLog/" + key).create({ at: Date.now(), by: me.uid }); }
      catch (e) { return res.status(200).json({ ok: true, dup: true }); }
      const all = await fs.collection("pushSubs").get();
      const subs = all.docs.filter((d) => { const s = d.data(); return s.uid !== me.uid && !(s.prefs && s.prefs[type] === false); });
      const r = await sendTo(subs, payload);
      return res.status(200).json({ ok: true, sent: r.sent });
    }
    return res.status(400).json({ error: "bad_action" });
  } catch (e) {
    return res.status(500).json({ error: "server", detail: String(e && e.message || e).slice(0, 120) });
  }
};
