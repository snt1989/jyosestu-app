// 通知(Web Push)の登録と送信。
// 環境変数: FIREBASE_SERVICE_ACCOUNT(既存)/ VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT(例 mailto:xxx@example.com)
const admin = require("firebase-admin");
const crypto = require("crypto");
const ADMINS = String(process.env.ADMIN_EMAILS || "admin@sanoh-ltd.jp").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const TYPES = ["note", "chat", "ann", "status", "report", "urgent"];
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
      let payload = null, key = "", scopeSite = "", scopeCrews = null;
      if (type === "note") {
        const d = await fs.doc("notes/" + id).get(); const n = d.exists ? d.data() : null;
        if (!n || n.by !== me.uid || !fresh(n.at, 600000)) return res.status(200).json({ ok: true, skipped: true });
        key = "note_" + id; scopeSite = n.siteId ? String(n.siteId) : "";
        payload = { title: "連絡: " + (n.siteId ? (n.siteName || "現場") : "全体"), body: clip((myName ? myName + ": " : "") + n.text, 100), tag: "note", url: "/?go=notes" };
      } else if (type === "chat") {
        const d = await fs.doc("notes/" + id).get(); const n = d.exists ? d.data() : null;
        if (!n || n.kind !== "chat" || n.by !== me.uid || !fresh(n.at, 600000)) return res.status(200).json({ ok: true, skipped: true });
        key = "chat_" + id; const room = String(n.room || "all");
        if (room !== "all") scopeCrews = [room];
        payload = { title: "チャット: " + (room === "all" ? "全体" : room), body: clip((myName ? myName + ": " : "") + n.text, 100), tag: "chat_" + room, url: "/?go=notes" };
      } else if (type === "ann") {
        const d = await fs.doc("announcements/" + id).get(); const a = d.exists ? d.data() : null;
        if (!a || a.by !== me.uid || !isAdm || !fresh(a.at, 600000)) return res.status(200).json({ ok: true, skipped: true });
        key = "ann_" + id; if (Array.isArray(a.crews) && a.crews.length) scopeCrews = a.crews.map((x) => String(x).trim()).filter(Boolean);
        payload = { title: (a.important ? "【重要】" : "お知らせ: ") + clip(a.title, 40), body: clip(a.body, 100), tag: "ann", url: "/" };
      } else if (type === "urgent") {
        // 要対応(警戒・出動目安)。天気は各端末で判定されるので、通知は現場ごと・段階ごとに1日1回だけ送る
        const lv = +b.lv; const snow = Math.max(0, Math.min(300, +b.snow || 0)); const th = Math.max(0, Math.min(300, +b.th || 0));
        if (lv !== 2 && lv !== 3) return res.status(400).json({ error: "bad_request" });
        const sd = await fs.doc("sites/" + id).get(); if (!sd.exists) return res.status(200).json({ ok: true, skipped: true });
        const site = sd.data();
        const crewsOf = String(site.crew || "").split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
        if (!isAdm) {
          const ac0 = await fs.doc("access/" + me.uid).get(); const mc = ac0.exists ? String(ac0.data().crew || "").trim() : "";
          if (!mc || crewsOf.indexOf(mc) < 0) return res.status(200).json({ ok: true, skipped: true });
        }
        const od = await fs.doc("ops/" + id).get(); if (od.exists && od.data().status === "out") return res.status(200).json({ ok: true, skipped: true });
        const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        key = "urgent_" + id + "_" + lv + "_" + day; scopeSite = id;
        payload = { title: (lv === 3 ? "【出動目安】" : "【警戒】") + clip(site.name || "現場", 30), body: clip((snow > 0 ? "降雪目安 約" + Math.round(snow * 10) / 10 + "cm" + (th ? "(基準" + th + "cm)" : "") : "降雪・凍結のおそれがあります") + (crewsOf.length ? " ・担当 " + crewsOf.join("、") : ""), 100), tag: "urgent-" + id, url: "/?site=" + encodeURIComponent(id) };
      } else if (type === "report") {
        const d = await fs.doc("reports/" + id).get(); const r = d.exists ? d.data() : null;
        if (!r || r.by !== me.uid || !fresh(r.at, 600000)) return res.status(200).json({ ok: true, skipped: true });
        key = "report_" + id; scopeSite = r.siteId ? String(r.siteId) : "";
        payload = { title: "日報: " + (r.siteName || "現場"), body: clip([r.crew, r.snowCm !== "" && r.snowCm != null ? "積雪 " + r.snowCm + "cm" : "", myName && !r.crew ? myName : ""].filter(Boolean).join(" ・ ") || "日報が提出されました", 100), tag: "report", url: "/?go=reports" };
      } else {
        const d = await fs.doc("ops/" + id).get(); const o = d.exists ? d.data() : null;
        if (!o || !ST[o.status] || !fresh(o.statusAt, 120000)) return res.status(200).json({ ok: true, skipped: true });
        const sd = await fs.doc("sites/" + id).get();
        key = "status_" + id + "_" + o.statusAt; scopeSite = id;
        payload = { title: ST[o.status] + ": " + (sd.exists ? sd.data().name : "現場"), body: clip((o.statusBy || myName || "") + (sd.exists && sd.data().crew ? "(担当 " + sd.data().crew + ")" : ""), 100) || "作業状況が更新されました", tag: "status_" + id, url: "/?site=" + encodeURIComponent(id) };
      }
      try { await fs.doc("pushLog/" + key).create({ at: Date.now(), by: me.uid }); }
      catch (e) { return res.status(200).json({ ok: true, dup: true }); }
      const all = await fs.collection("pushSubs").get();
      let subs = all.docs.filter((d) => { const s = d.data(); return s.uid !== me.uid && !(s.prefs && s.prefs[type] === false); });
      if (scopeSite || scopeCrews) {
        // 現場に紐づく通知は、管理者と、その現場の担当班のメンバーだけに送る
        let crews = scopeCrews;
        if (!crews) {
          const sd2 = await fs.doc("sites/" + scopeSite).get();
          crews = sd2.exists ? String(sd2.data().crew || "").split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
        }
        const uids = Array.from(new Set(subs.map((d) => d.data().uid)));
        const okU = {};
        await Promise.all(uids.map(async (u) => {
          try {
            const [us, ac] = await Promise.all([fs.doc("users/" + u).get(), fs.doc("access/" + u).get()]);
            const ud2 = us.exists ? us.data() : {};
            const adm = ud2.role === "admin" || ADMINS.indexOf(String(ud2.email || "").toLowerCase()) >= 0;
            const myCrew = ac.exists ? String(ac.data().crew || "").trim() : "";
            okU[u] = adm || (!!myCrew && crews.indexOf(myCrew) >= 0);
          } catch (e) { okU[u] = false; }
        }));
        subs = subs.filter((d) => okU[d.data().uid]);
      }
      const r = await sendTo(subs, payload);
      return res.status(200).json({ ok: true, sent: r.sent });
    }
    return res.status(400).json({ error: "bad_action" });
  } catch (e) {
    return res.status(500).json({ error: "server", detail: String(e && e.message || e).slice(0, 120) });
  }
};
